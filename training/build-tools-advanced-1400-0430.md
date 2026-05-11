# 🔧 构建工具进阶专项 — 深入构建系统内核

**时间：** 2026-04-30 14:00  
**前置：** 基础构建工具知识 (已有 `build-tools-1400.md`)  
**目标：** 深入构建系统内核，掌握插件开发、Module Federation、增量编译、性能调优

---

## 一、构建工具架构深度解析

### 1.1 构建工具的三层架构

```
┌─────────────────────────────────────────────────────────┐
│                   用户配置层                              │
│  webpack.config.js / vite.config.js / rollup.config.js   │
├─────────────────────────────────────────────────────────┤
│                   核心引擎层                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐              │
│  │ 解析器    │→│ 转换器    │→│ 生成器    │              │
│  │ Parser   │  │ Transformer│ │ Generator│              │
│  └──────────┘  └──────────┘  └──────────┘              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐              │
│  │ 依赖图    │  │ 优化器    │  │ 输出器    │              │
│  │ Graph    │  │ Optimizer│  │ Emitter  │              │
│  └──────────┘  └──────────┘  └──────────┘              │
├─────────────────────────────────────────────────────────┤
│                   扩展插件层                              │
│  Loaders / Plugins / Transformers / Resolvers            │
└─────────────────────────────────────────────────────────┘
```

### 1.2 Webpack 编译生命周期

```
┌──────────────────────────────────────────────────────────────────┐
│                    Webpack 编译生命周期                           │
│                                                                  │
│  初始化阶段 (Compiler)                                            │
│  ┌─────────────────────────────────────────────────────────┐     │
│  │ 1. new WebpackOptionsApply()                            │     │
│  │ 2. 创建 Compiler 实例                                    │     │
│  │ 3. 加载所有插件                                          │     │
│  │ 4. 挂载 environment, compiler, compilation 钩子          │     │
│  │ 5. run / watch / watchRun 钩子触发                       │     │
│  └─────────────────────────────────────────────────────────┘     │
│         ↓                                                        │
│  编译阶段 (Compilation)                                           │
│  ┌─────────────────────────────────────────────────────────┐     │
│  │ 6. make 钩子 — 开始构建模块                               │     │
│  │ 7. buildModule — 构建单个模块                             │     │
│  │    ├─ normalModuleLoader                                 │     │
│  │    ├─ loader 管道 (从右到左执行)                          │     │
│  │    └─ 生成 AST → 转换 → 代码                             │     │
│  │ 8. seal 钩子 — 开始分块和优化                             │     │
│  │    ├─ optimizeChunks — 优化 chunk 分割                   │     │
│  │    ├─ optimizeModules — 优化模块 (Tree Shaking)          │     │
│  │    ├─ optimizeChunkAssets — 优化 chunk 资源              │     │
│  │    └─ optimizeAssets — 优化所有资源                      │     │
│  └─────────────────────────────────────────────────────────┘     │
│         ↓                                                        │
│  输出阶段 (Emit)                                                  │
│  ┌─────────────────────────────────────────────────────────┐     │
│  │ 9. emitAssets — 生成最终文件                             │     │
│  │ 10. afterEmit — 输出后处理                               │     │
│  │ 11. done — 编译完成                                      │     │
│  └─────────────────────────────────────────────────────────┘     │
│                                                                  │
│  关键 Hook 时序:                                                  │
│  run → compile → make → buildModule → seal →                     │
│  emit → afterEmit → done                                         │
│                                                                  │
│  Watch 模式额外:                                                  │
│  watchRun → compile (增量) → ... → done                          │
└──────────────────────────────────────────────────────────────────┘
```

### 1.3 Vite 开发服务器架构

```
┌──────────────────────────────────────────────────────────────────┐
│                     Vite 开发服务器架构                            │
│                                                                  │
│  浏览器请求 /src/main.tsx                                         │
│         ↓                                                        │
│  ┌─────────────────────────────────────────────────────────┐     │
│  │              Connect Middleware Pipeline                 │     │
│  │                                                         │     │
│  │  ① indexHtmlMiddleware — HTML 入口处理                  │     │
│  │     • 解析 <script type="module">                       │     │
│  │     • 注入 HMR 客户端                                    │     │
│  │     • 转换 import 路径 (添加 ?import 后缀)               │     │
│  │         ↓                                               │     │
│  │  ② pluginContainerMiddleware — 插件容器                  │     │
│  │     • resolveId — 模块 ID 解析                           │     │
│  │     • load — 模块内容加载                                │     │
│  │     • transform — 模块内容转换                           │     │
│  │         ↓                                               │     │
│  │  ③ serverMiddleware — 服务器中间件                       │     │
│  │     • 静态文件服务                                       │     │
│  │     • 代理转发                                           │     │
│  │     • 404 处理                                          │     │
│  └─────────────────────────────────────────────────────────┘     │
│         ↓                                                        │
│  浏览器收到转换后的 ESM 代码                                       │
│  浏览器继续请求 import 的依赖 → 重复上述流程                       │
│                                                                  │
│  关键区别:                                                        │
│  • Webpack: 一次性打包所有模块 → 发送 bundle                      │
│  • Vite:    按需转换每个模块 → 浏览器原生 ESM 加载                │
│  • 启动速度差异: Webpack O(n) vs Vite O(1)                       │
│                                                                  │
│  依赖预构建 (optimizeDeps):                                       │
│  • node_modules 中的 CJS 包 → 用 esbuild 预构建为 ESM            │
│  • 原因: 浏览器不支持 CJS, 且大量小文件请求慢                     │
│  • 预构建产物: node_modules/.vite/deps/                          │
└──────────────────────────────────────────────────────────────────┘
```

---

## 二、手写 Webpack 风格插件系统

### 2.1 Tapable — 钩子系统

Webpack 的插件系统基于 Tapable，这是一个类似 Node.js EventEmitter 但支持同步/异步/瀑布流的钩子库。

```javascript
// tapable-lite.js — Tapable 核心实现 (精简版)

// ============ 基础 Hook 类 ============

class Hook {
  constructor(args = []) {
    this.args = args;
    this.taps = []; // 注册的回调
  }

  tap(name, fn) {
    this.taps.push({ name, fn });
  }

  tapAsync(name, fn) {
    this.taps.push({ name, type: 'async', fn });
  }

  tapPromise(name, fn) {
    this.taps.push({ name, type: 'promise', fn });
  }
}

// ============ SyncHook — 同步钩子 ============

class SyncHook extends Hook {
  call(...args) {
    for (const tap of this.taps) {
      tap.fn(...args);
    }
  }
}

// ============ SyncBailHook — 同步拦截钩子 ============
// 任何一个回调返回非 undefined，后续回调不再执行

class SyncBailHook extends Hook {
  call(...args) {
    for (const tap of this.taps) {
      const result = tap.fn(...args);
      if (result !== undefined) return result;
    }
    return undefined;
  }
}

// ============ SyncWaterfallHook — 同步瀑布钩子 ============
// 上一个回调的返回值传递给下一个回调

class SyncWaterfallHook extends Hook {
  call(...args) {
    let [first, ...rest] = args;
    for (const tap of this.taps) {
      first = tap.fn(first, ...rest);
    }
    return first;
  }
}

// ============ AsyncSeriesHook — 异步串行钩子 ============

class AsyncSeriesHook extends Hook {
  async callAsync(...args) {
    for (const tap of this.taps) {
      if (tap.type === 'promise') {
        await tap.fn(...args);
      } else if (tap.type === 'async') {
        await new Promise((resolve) => {
          tap.fn(...args, resolve);
        });
      } else {
        tap.fn(...args);
      }
    }
  }
}

// ============ AsyncParallelHook — 异步并行钩子 ============

class AsyncParallelHook extends Hook {
  async callAsync(...args) {
    const promises = this.taps.map((tap) => {
      if (tap.type === 'promise') {
        return tap.fn(...args);
      }
      return new Promise((resolve) => {
        tap.fn(...args, resolve);
      });
    });
    await Promise.all(promises);
  }
}

// ============ HookMap — 动态钩子映射 ============

class HookMap {
  constructor(factory) {
    this._map = new Map();
    this._factory = factory;
  }

  get(key) {
    if (!this._map.has(key)) {
      this._map.set(key, this._factory(key));
    }
    return this._map.get(key);
  }
}

// ============ 导出 ============

module.exports = {
  SyncHook,
  SyncBailHook,
  SyncWaterfallHook,
  AsyncSeriesHook,
  AsyncParallelHook,
  HookMap,
};
```

### 2.2 手写迷你 Compiler

```javascript
// mini-compiler.js — 迷你编译器 (模拟 Webpack Compiler)

const fs = require('fs');
const path = require('path');
const { parse } = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const { transformFromAstSync } = require('@babel/core');
const {
  SyncHook,
  SyncBailHook,
  SyncWaterfallHook,
  AsyncSeriesHook,
} = require('./tapable-lite');

class MiniCompiler {
  constructor(options) {
    this.options = options;
    this.context = options.context || process.cwd();
    this.entries = new Set();
    this.modules = new Map(); // moduleId → moduleInfo
    this.chunks = new Map();  // chunkId → [moduleIds]
    this.assets = new Map();  // fileName → content

    // 编译钩子 (模拟 Webpack Compiler hooks)
    this.hooks = {
      // 初始化阶段
      entryOption: new SyncHook(['entry']),
      initialize: new SyncHook([]),
      // 编译阶段
      compile: new SyncHook(['params']),
      make: new AsyncSeriesHook(['compilation']),
      buildModule: new SyncHook(['module']),
      seal: new SyncHook([]),
      optimize: new SyncHook([]),
      // 输出阶段
      emit: new AsyncSeriesHook(['compilation']),
      afterEmit: new AsyncSeriesHook(['compilation']),
      done: new SyncHook(['stats']),
    };

    // 插件列表
    this.plugins = options.plugins || [];
  }

  // 挂载插件
  applyPlugins() {
    for (const plugin of this.plugins) {
      if (typeof plugin === 'function') {
        plugin(this);
      } else if (plugin.apply) {
        plugin.apply(this);
      }
    }
  }

  // 主编译入口
  async run() {
    console.log('🚀 Compiler starting...');

    // 1. 初始化
    this.hooks.initialize.call();

    // 2. 挂载插件
    this.applyPlugins();

    // 3. 触发 entryOption
    this.hooks.entryOption.call(this.options.entry);

    // 4. 编译阶段
    this.hooks.compile.call({});

    // 5. make — 构建模块图
    await this.hooks.make.callAsync(this);

    // 6. seal — 分块和优化
    this.hooks.seal.call();
    this.hooks.optimize.call();

    // 7. 生成 assets
    this.generateAssets();

    // 8. emit — 输出文件
    await this.hooks.emit.callAsync(this);

    // 9. afterEmit
    await this.hooks.afterEmit.callAsync(this);

    // 10. done
    this.hooks.done.call({
      modules: this.modules.size,
      chunks: this.chunks.size,
      assets: this.assets.size,
    });

    console.log('✅ Compiler finished!');
  }

  // 构建模块依赖图
  async buildModule(entryPath) {
    const moduleId = path.relative(this.context, entryPath);
    if (this.modules.has(moduleId)) return;

    this.hooks.buildModule.call({ id: moduleId, path: entryPath });

    const content = fs.readFileSync(entryPath, 'utf-8');

    // 解析 AST
    const ast = parse(content, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript'],
    });

    // 收集依赖
    const dependencies = [];
    traverse(ast, {
      ImportDeclaration: ({ node }) => {
        const source = node.source.value;
        // 跳过 node_modules (简化处理)
        if (!source.startsWith('.') && !source.startsWith('/')) return;
        const depPath = path.resolve(path.dirname(entryPath), source);
        dependencies.push(depPath);
      },
    });

    // 转换代码
    const { code } = transformFromAstSync(ast, null, {
      presets: ['@babel/preset-env'],
      filename: entryPath,
    });

    this.modules.set(moduleId, {
      id: moduleId,
      path: entryPath,
      code,
      dependencies,
      raw: content,
    });

    // 递归构建依赖
    for (const dep of dependencies) {
      await this.buildModule(dep);
    }
  }

  // 分块
  createChunks() {
    const entryId = path.relative(this.context, this.options.entry);
    this.chunks.set('main', [entryId]);
  }

  // 生成输出
  generateAssets() {
    const entryId = path.relative(this.context, this.options.entry);
    const entryModule = this.modules.get(entryId);
    if (!entryModule) return;

    // 生成 bundle 代码
    const bundle = this.createBundle(entryId);
    const filename = this.options.output?.filename || 'bundle.js';
    this.assets.set(filename, bundle);
  }

  createBundle(entryId) {
    const moduleMap = {};
    for (const [id, mod] of this.modules) {
      moduleMap[`./${path.basename(id)}`] = mod.code;
    }

    const depsMap = {};
    for (const [id, mod] of this.modules) {
      const key = `./${path.basename(id)}`;
      depsMap[key] = {};
      mod.dependencies.forEach((dep) => {
        const depKey = `./${path.basename(dep)}`;
        depsMap[key][depKey] = depKey;
      });
    }

    return `
(function(moduleMap, depsMap) {
  var moduleCache = {};
  
  function require(moduleKey) {
    if (moduleCache[moduleKey]) {
      return moduleCache[moduleKey].exports;
    }
    
    var module = { exports: {}, id: moduleKey };
    moduleCache[moduleKey] = module;
    
    var moduleFn = moduleMap[moduleKey];
    var localRequire = function(path) {
      var resolved = depsMap[moduleKey][path];
      return require(resolved);
    };
    
    moduleFn(localRequire, module, module.exports);
    return module.exports;
  }
  
  require('./${path.basename(entryId)}');
})(${JSON.stringify(moduleMap)}, ${JSON.stringify(depsMap)});
    `.trim();
  }
}

module.exports = MiniCompiler;
```

### 2.3 手写插件示例

```javascript
// plugins.js — 自定义插件示例

// ============ 插件 1: BannerPlugin ============

class BannerPlugin {
  constructor(options = {}) {
    this.banner = options.banner || 'Built with MiniCompiler';
    this.onlyEntry = options.onlyEntry !== false;
  }

  apply(compiler) {
    compiler.hooks.emit.tapAsync('BannerPlugin', (compilation, callback) => {
      for (const [filename, content] of compilation.assets) {
        if (this.onlyEntry && filename !== 'bundle.js') continue;
        compilation.assets.set(filename, this.banner + '\n' + content);
      }
      callback();
    });
  }
}

// ============ 插件 2: CleanPlugin ============

class CleanPlugin {
  constructor(options = {}) {
    this.paths = options.paths || ['dist'];
  }

  apply(compiler) {
    compiler.hooks.initialize.tap('CleanPlugin', () => {
      const fs = require('fs');
      for (const p of this.paths) {
        const fullPath = path.join(compiler.context, p);
        if (fs.existsSync(fullPath)) {
          fs.rmSync(fullPath, { recursive: true, force: true });
          console.log(`🧹 Cleaned: ${p}`);
        }
      }
    });
  }
}

// ============ 插件 3: HtmlPlugin ============

class HtmlPlugin {
  constructor(options = {}) {
    this.template = options.template || '<!DOCTYPE html><html><head></head><body><div id="app"></div></body></html>';
    this.filename = options.filename || 'index.html';
  }

  apply(compiler) {
    compiler.hooks.emit.tapAsync('HtmlPlugin', (compilation, callback) => {
      const scriptTags = Array.from(compilation.assets.keys())
        .filter((f) => f.endsWith('.js'))
        .map((f) => `<script src="${f}"></script>`)
        .join('\n');

      let html = this.template;
      if (html.includes('</body>')) {
        html = html.replace('</body>', `${scriptTags}\n</body>`);
      } else {
        html += `\n${scriptTags}`;
      }

      compilation.assets.set(this.filename, html);
      callback();
    });
  }
}

// ============ 插件 4: StatsPlugin ============

class StatsPlugin {
  constructor(options = {}) {
    this.filename = options.filename || 'stats.json';
  }

  apply(compiler) {
    compiler.hooks.done.tap('StatsPlugin', (stats) => {
      const data = {
        timestamp: new Date().toISOString(),
        modules: stats.modules,
        chunks: stats.chunks,
        assets: stats.assets,
        modulesDetail: [],
      };

      for (const [id, mod] of compiler.modules) {
        data.modulesDetail.push({
          id,
          size: Buffer.byteLength(mod.code, 'utf-8'),
          deps: mod.dependencies.length,
        });
      }

      data.modulesDetail.sort((a, b) => b.size - a.size);

      const fs = require('fs');
      const path = require('path');
      fs.writeFileSync(
        path.join(compiler.context, compiler.options.output?.path || 'dist', this.filename),
        JSON.stringify(data, null, 2)
      );
      console.log(`📊 Stats written to ${this.filename}`);
    });
  }
}

// ============ 插件 5: 函数式插件 ============

// Webpack 也支持函数式插件
function loggerPlugin(compiler) {
  compiler.hooks.compile.tap('LoggerPlugin', () => {
    console.log('📝 [Logger] Compilation started');
  });

  compiler.hooks.buildModule.tap('LoggerPlugin', (module) => {
    console.log(`  📦 Building: ${module.id}`);
  });

  compiler.hooks.done.tap('LoggerPlugin', (stats) => {
    console.log(`✅ [Logger] Done! ${stats.modules} modules, ${stats.assets} assets`);
  });
}

module.exports = {
  BannerPlugin,
  CleanPlugin,
  HtmlPlugin,
  StatsPlugin,
  loggerPlugin,
};
```

### 2.4 完整使用示例

```javascript
// build.js — 使用迷你编译器
const path = require('path');
const MiniCompiler = require('./mini-compiler');
const {
  BannerPlugin,
  CleanPlugin,
  HtmlPlugin,
  StatsPlugin,
  loggerPlugin,
} = require('./plugins');

const compiler = new MiniCompiler({
  context: process.cwd(),
  entry: path.resolve(__dirname, 'src/index.js'),
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'bundle.js',
  },
  plugins: [
    new CleanPlugin({ paths: ['dist'] }),
    new HtmlPlugin({
      template: `
        <!DOCTYPE html>
        <html lang="zh">
        <head><meta charset="utf-8"><title>Mini App</title></head>
        <body><div id="app"></div></body>
        </html>
      `,
    }),
    new BannerPlugin({ banner: '/* MiniCompiler v1.0 */' }),
    new StatsPlugin(),
    loggerPlugin, // 函数式插件
  ],
});

compiler.run().catch(console.error);
```

---

## 三、Vite 插件开发深度

### 3.1 Vite 插件钩子全景

```
Vite 插件钩子执行顺序 (开发模式):

┌─────────────────────────────────────────────────────────────┐
│  服务器启动                                                    │
│  ├─ config (async) — 修改 Vite 配置                           │
│  ├─ configResolved — 读取最终配置                              │
│  ├─ configureServer — 添加自定义中间件                         │
│  ├─ transformedResult — 处理转换结果                           │
│  └─ buildStart (async) — 构建开始                             │
│                                                              │
│  请求处理 (每个模块请求)                                        │
│  ├─ resolveId (async) — 解析模块 ID                           │
│  ├─ load (async) — 加载模块内容                               │
│  ├─ transform (async) — 转换模块代码                          │
│  └─ hotUpdate — HMR 更新处理                                  │
│                                                              │
│  生产构建                                                      │
│  ├─ options (async) — 修改 Rollup options                     │
│  ├─ buildStart (async) — 构建开始                             │
│  ├─ resolveId (async) — 解析模块 ID                           │
│  ├─ load (async) — 加载模块内容                               │
│  ├─ transform (async) — 转换模块代码                          │
│  ├─ buildEnd (async) — 构建结束                               │
│  └─ closeBundle (async) — 关闭打包器                          │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 手写 Vite 插件

#### 插件 1: Markdown 组件插件

```javascript
// vite-plugin-mdx.js — 将 .md 文件转为可导入的组件

const { compileToJS } = require('@mdx-js/compiler');
const { remarkGfm } = require('remark-gfm');

function vitePluginMdx(options = {}) {
  return {
    name: 'vite-plugin-mdx',

    // 解析 .md/.mdx 文件的模块 ID
    async resolveId(source, importer) {
      if (source.match(/\.mdx?$/)) {
        // 返回规范化路径
        return path.resolve(path.dirname(importer || ''), source);
      }
    },

    // 加载并转换 .md/.mdx 文件
    async load(id) {
      if (!id.match(/\.mdx?$/)) return null;

      const fs = require('fs');
      const raw = fs.readFileSync(id, 'utf-8');

      // 使用 MDX 编译器转换为 JSX
      const result = await compileToJS(raw, {
        filepath: id,
        remarkPlugins: [remarkGfm],
        jsx: true,
        jsxRuntime: 'automatic',
      });

      // 包装为 Vite 可处理的 ESM 模块
      return `
        ${result.code}
        export default MDXContent;
      `;
    },

    // HMR 支持
    handleHotUpdate({ file, server }) {
      if (file.match(/\.mdx?$/)) {
        // 找到引用该 md 文件的模块
        const mods = Array.from(server.moduleGraph.fileToModulesMap.get(file) || []);
        return mods;
      }
    },
  };
}
```

#### 插件 2: SVG Sprite 插件

```javascript
// vite-plugin-svg-sprite.js — 自动生成 SVG Sprite

const fs = require('fs');
const path = require('path');
const { optimize } = require('svgo');

function vitePluginSvgSprite(options = {}) {
  const { spriteDir = 'src/assets/icons', symbolPrefix = 'icon' } = options;

  return {
    name: 'vite-plugin-svg-sprite',
    enforce: 'pre',

    resolveId(source) {
      if (source === 'virtual:svg-sprite') {
        return '\0' + source;
      }
    },

    load(id) {
      if (id === '\0virtual:svg-sprite') {
        // 扫描 SVG 文件目录
        const iconsDir = path.resolve(process.cwd(), spriteDir);
        const files = fs.readdirSync(iconsDir).filter((f) => f.endsWith('.svg'));

        const symbols = files
          .map((file) => {
            const content = fs.readFileSync(path.join(iconsDir, file), 'utf-8');
            const name = file.replace('.svg', '');
            // 提取 <svg> 内容，添加 id
            const optimized = optimize(content, {
              plugins: [{ name: 'removeDimensions' }],
            });
            const svgContent = optimized.data
              .replace(/<svg[^>]*>/, '')
              .replace(/<\/svg>/, '');
            return `<symbol id="${symbolPrefix}-${name}" viewBox="0 0 24 24">${svgContent}</symbol>`;
          })
          .join('\n');

        return `
          const sprite = \`<svg xmlns="http://www.w3.org/2000/svg" style="display:none">\n${symbols}\n</svg>\`;
          
          // 注入到页面
          if (typeof document !== 'undefined' && !document.getElementById('svg-sprite')) {
            const div = document.createElement('div');
            div.id = 'svg-sprite';
            div.innerHTML = sprite;
            document.body.insertBefore(div, document.body.firstChild);
          }
          
          export default sprite;
          export const icons = ${JSON.stringify(files.map((f) => f.replace('.svg', '')))};
        `;
      }
    },
  };
}
```

#### 插件 3: 环境变量注入插件

```javascript
// vite-plugin-env-inject.js — 自定义环境变量注入

const fs = require('fs');
const path = require('path');

function vitePluginEnvInject(options = {}) {
  const { envDir = process.cwd(), prefix = 'VITE_' } = options;

  return {
    name: 'vite-plugin-env-inject',
    enforce: 'pre',

    config(config, { command, mode }) {
      // 加载 .env 文件
      const envFiles = [
        '.env',
        `.env.${mode}`,
        `.env.${mode}.local`,
        '.env.local',
      ];

      const env = {};
      for (const file of envFiles) {
        const filePath = path.join(envDir, file);
        if (fs.existsSync(filePath)) {
          const content = fs.readFileSync(filePath, 'utf-8');
          content.split('\n').forEach((line) => {
            line = line.trim();
            if (!line || line.startsWith('#')) return;
            const [key, ...valueParts] = line.split('=');
            const value = valueParts.join('=').trim();
            // 移除引号
            const cleanValue = value.replace(/^["']|["']$/g, '');
            if (key.startsWith(prefix) || key === 'NODE_ENV') {
              env[key] = cleanValue;
            }
          });
        }
      }

      // 注入 define 配置
      const defines = {};
      for (const [key, value] of Object.entries(env)) {
        defines[`import.meta.env.${key}`] = JSON.stringify(value);
        defines[`process.env.${key}`] = JSON.stringify(value);
      }

      // 注入 client 端可用的变量
      defines['import.meta.env'] = `{ ${Object.entries(env)
        .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
        .join(', ')} }`;

      return {
        define: defines,
      };
    },
  };
}
```

#### 插件 4: 图片优化插件

```javascript
// vite-plugin-image-optimize.js — 自动图片优化

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

function vitePluginImageOptimize(options = {}) {
  const {
    include = /\.(png|jpe?g|webp)$/i,
    quality = 80,
    webpQuality = 75,
    maxSize = 1024 * 1024, // 1MB
  } = options;

  return {
    name: 'vite-plugin-image-optimize',
    enforce: 'pre',

    async load(id) {
      if (!include.test(id)) return null;

      const stats = fs.statSync(id);
      if (stats.size < maxSize) return null; // 小文件不处理

      const ext = path.extname(id).toLowerCase();

      // 转换为 WebP (更小的体积)
      if (ext !== '.webp') {
        const webpBuffer = await sharp(id)
          .webp({ quality: webpQuality })
          .toBuffer();

        const webpId = id.replace(ext, '.webp');
        // 注册 WebP 变体
        this.emitFile({
          type: 'asset',
          name: path.basename(webpId),
          source: webpBuffer,
        });
      }

      // 返回原始文件 (让 Vite 的 asset 插件处理)
      return null;
    },

    // 生成 <picture> 标签的辅助函数
    transform(code, id) {
      if (!include.test(id)) return null;

      // 为图片导入添加 srcset 支持
      return {
        code,
        map: null,
      };
    },
  };
}
```

---

## 四、Module Federation 深度

### 4.1 什么是 Module Federation？

Module Federation 允许多个独立的 Webpack 构建体在运行时共享模块。每个构建体可以独立开发、独立部署，但在运行时动态加载彼此的代码。

```
┌──────────────────────────────────────────────────────────────────┐
│                   Module Federation 架构                          │
│                                                                  │
│  ┌─────────────────┐     ┌─────────────────┐     ┌─────────────┐│
│  │   Host App      │     │   Remote A      │     │  Remote B   ││
│  │  (主应用)        │     │  (用户服务)      │     │ (订单服务)   ││
│  │                 │     │                 │     │             ││
│  │ exposes:        │     │ exposes:        │     │ exposes:    ││
│  │  - ./AppShell   │     │  - ./UserList   │     │  - ./Order  ││
│  │  - ./Nav        │     │  - ./UserProfile│     │  - ./Cart   ││
│  │                 │     │                 │     │             ││
│  │ remotes:        │     │ remotes:        │     │ remotes:    │
│  │  - Users@urlA   │     │  - Orders@urlB  │     │  - Users@urlA│
│  │  - Orders@urlB  │     │                 │     │             ││
│  └─────────────────┘     └─────────────────┘     └─────────────┘│
│         │                        │                       │       │
│         └────────────────────────┼───────────────────────┘       │
│                                  │                               │
│                    运行时动态加载                                  │
│                    import('Users/UserList')                       │
│                    import('Orders/Order')                         │
│                                                                  │
│  关键优势:                                                        │
│  • 独立部署 — 每个 Remote 独立构建和部署                          │
│  • 共享依赖 — 共享 React/Vue 等库，避免重复加载                    │
│  • 运行时集成 — 不需要构建时知道所有 Remote                        │
│  • 版本控制 — 可以指定依赖版本                                     │
└──────────────────────────────────────────────────────────────────┘
```

### 4.2 Module Federation 配置

```javascript
// Host App — webpack.config.js
const { ModuleFederationPlugin } = require('webpack').container;

module.exports = {
  plugins: [
    new ModuleFederationPlugin({
      name: 'host',
      remotes: {
        // 远程模块: 名称 @ URL
        users: 'users@http://localhost:3001/remoteEntry.js',
        orders: 'orders@http://localhost:3002/remoteEntry.js',
      },
      shared: {
        // 共享依赖 (版本协商)
        react: {
          singleton: true,      // 全局只加载一个版本
          requiredVersion: '^18.0.0',
        },
        'react-dom': {
          singleton: true,
          requiredVersion: '^18.0.0',
        },
      },
    }),
  ],
};

// Host App — 使用远程模块
// src/App.jsx
const UserList = React.lazy(() => import('users/UserList'));
const OrderPage = React.lazy(() => import('orders/OrderPage'));

function App() {
  return (
    <Suspense fallback={<Loading />}>
      <Route path="/users" element={<UserList />} />
      <Route path="/orders" element={<OrderPage />} />
    </Suspense>
  );
}
```

```javascript
// Remote A (users) — webpack.config.js
const { ModuleFederationPlugin } = require('webpack').container;

module.exports = {
  plugins: [
    new ModuleFederationPlugin({
      name: 'users',
      filename: 'remoteEntry.js',
      exposes: {
        './UserList': './src/UserList',
        './UserProfile': './src/UserProfile',
      },
      shared: {
        react: { singleton: true },
        'react-dom': { singleton: true },
      },
    }),
  ],
};
```

### 4.3 Module Federation 运行时原理

```javascript
// 简化版 Module Federation 运行时

class FederationRuntime {
  constructor(config) {
    this.remotes = new Map(); // name → config
    this.modules = new Map(); // name:export → module
    this.shared = new Map();  // packageName → instance
    this.config = config;
  }

  // 注册远程模块
  registerRemote(name, config) {
    this.remotes.set(name, {
      url: config.url,
      entry: config.entry || 'remoteEntry.js',
      loaded: false,
    });
  }

  // 加载远程模块入口
  async loadRemoteEntry(name) {
    const remote = this.remotes.get(name);
    if (!remote) throw new Error(`Remote "${name}" not registered`);
    if (remote.loaded) return;

    // 1. 动态加载 remoteEntry.js
    const script = document.createElement('script');
    script.src = `${remote.url}/${remote.entry}`;
    script.onload = () => {
      // 2. remoteEntry.js 会在全局注册 __webpack_require__.f.consumes
      remote.loaded = true;
    };
    document.head.appendChild(script);

    // 等待加载完成
    await new Promise((resolve, reject) => {
      script.onload = resolve;
      script.onerror = reject;
    });
  }

  // 获取远程模块
  async getRemoteModule(name, exportName) {
    const key = `${name}:${exportName}`;
    if (this.modules.has(key)) {
      return this.modules.get(key);
    }

    await this.loadRemoteEntry(name);

    // 通过 Webpack 的 container API 获取模块
    const container = window[name];
    if (!container) throw new Error(`Remote container "${name}" not found`);

    // 初始化 (共享依赖)
    await container.init(this.getSharedScope());

    // 获取模块工厂
    const factory = await container.get(`./${exportName}`);
    const module = factory();

    this.modules.set(key, module);
    return module;
  }

  // 构建共享作用域
  getSharedScope() {
    const scope = {};
    for (const [pkg, instance] of this.shared) {
      scope[pkg] = {
        [instance.version]: {
          get: () => () => instance,
          loaded: true,
        },
      };
    }
    return scope;
  }

  // 注册共享模块
  registerShared(packageName, instance) {
    this.shared.set(packageName, instance);
  }
}

// 使用示例
const runtime = new FederationRuntime({});
runtime.registerRemote('users', { url: 'http://localhost:3001' });
runtime.registerShared('react', React);
runtime.registerShared('react-dom', ReactDOM);

// 动态加载远程组件
const UserList = await runtime.getRemoteModule('users', 'UserList');
```

---

## 五、增量编译与缓存策略

### 5.1 Webpack 持久化缓存

```javascript
// webpack.config.js — 持久化缓存配置

module.exports = {
  cache: {
    // 文件系统缓存 (Webpack 5+)
    type: 'filesystem',
    buildDependencies: {
      // 配置文件变化时缓存失效
      config: [__filename],
    },
    // 缓存目录
    cacheDirectory: path.resolve(__dirname, '.webpack-cache'),
    // 缓存名称 (支持多环境)
    name: process.env.NODE_ENV,
    // 版本 (手动使缓存失效)
    version: '1.0.0',
  },

  // 模块 ID 持久化
  optimization: {
    moduleIds: 'deterministic', // 稳定的模块 ID
    chunkIds: 'deterministic',  // 稳定的 chunk ID
  },
};
```

### 5.2 手写增量编译器

```javascript
// incremental-compiler.js — 增量编译器

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class IncrementalCompiler {
  constructor(options) {
    this.entry = options.entry;
    this.output = options.output;
    this.cacheDir = options.cacheDir || '.build-cache';
    this.cache = this.loadCache();
    this.fileHashes = new Map(); // filePath → hash
    this.modules = new Map();
  }

  // 计算文件哈希
  hashFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    return crypto.createHash('md5').update(content).digest('hex');
  }

  // 加载缓存
  loadCache() {
    const cachePath = path.join(this.cacheDir, 'cache.json');
    if (fs.existsSync(cachePath)) {
      return JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
    }
    return { modules: {}, version: Date.now() };
  }

  // 保存缓存
  saveCache() {
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    }
    fs.writeFileSync(
      path.join(this.cacheDir, 'cache.json'),
      JSON.stringify(this.cache, null, 2)
    );
  }

  // 检查文件是否变化
  isFileChanged(filePath) {
    const currentHash = this.hashFile(filePath);
    const cachedHash = this.cache.modules[filePath]?.hash;
    this.fileHashes.set(filePath, currentHash);
    return currentHash !== cachedHash;
  }

  // 构建单个模块 (带缓存)
  buildModule(filePath) {
    const changed = this.isFileChanged(filePath);

    if (!changed && this.cache.modules[filePath]) {
      // 使用缓存
      const cached = this.cache.modules[filePath];
      console.log(`  ⚡ Cache hit: ${path.basename(filePath)}`);
      return {
        id: filePath,
        code: cached.code,
        dependencies: cached.dependencies,
      };
    }

    // 重新构建
    console.log(`  🔨 Building: ${path.basename(filePath)}`);
    const content = fs.readFileSync(filePath, 'utf-8');

    // 解析依赖
    const { parse } = require('@babel/parser');
    const traverse = require('@babel/traverse').default;
    const ast = parse(content, { sourceType: 'module', plugins: ['jsx'] });

    const dependencies = [];
    traverse(ast, {
      ImportDeclaration({ node }) {
        const source = node.source.value;
        if (source.startsWith('.') || source.startsWith('/')) {
          dependencies.push(path.resolve(path.dirname(filePath), source));
        }
      },
    });

    // 转换代码
    const { transformFromAstSync } = require('@babel/core');
    const { code } = transformFromAstSync(ast, null, {
      presets: ['@babel/preset-env'],
    });

    // 更新缓存
    const currentHash = this.fileHashes.get(filePath);
    this.cache.modules[filePath] = {
      hash: currentHash,
      code,
      dependencies,
      timestamp: Date.now(),
    };

    return { id: filePath, code, dependencies };
  }

  // 增量构建
  async build() {
    console.log('🔄 Incremental build started...\n');
    const startTime = Date.now();

    // 1. 构建依赖图
    const queue = [this.entry];
    const visited = new Set();

    while (queue.length > 0) {
      const filePath = queue.shift();
      if (visited.has(filePath)) continue;
      visited.add(filePath);

      const module = this.buildModule(filePath);
      this.modules.set(filePath, module);

      // 加入依赖
      for (const dep of module.dependencies) {
        if (!visited.has(dep)) {
          queue.push(dep);
        }
      }
    }

    // 2. 生成 bundle
    this.generateBundle();

    // 3. 保存缓存
    this.saveCache();

    const elapsed = Date.now() - startTime;
    console.log(`\n✅ Build complete in ${elapsed}ms`);
    console.log(`📦 ${this.modules.size} modules`);
  }

  generateBundle() {
    const moduleMap = {};
    for (const [id, mod] of this.modules) {
      moduleMap[`./${path.basename(id)}`] = mod.code;
    }

    const bundle = `
(function(moduleMap) {
  var cache = {};
  function require(key) {
    if (!cache[key]) {
      cache[key] = { exports: {} };
      moduleMap[key](cache[key].exports, require);
    }
    return cache[key].exports;
  }
  require('./${path.basename(this.entry)}');
})(${JSON.stringify(moduleMap)});
    `.trim();

    const outDir = path.dirname(this.output);
    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true });
    }
    fs.writeFileSync(this.output, bundle);
  }
}

module.exports = IncrementalCompiler;
```

### 5.3 Turbopack 增量编译原理

```
Turbopack 增量编译核心设计:

┌─────────────────────────────────────────────────────────┐
│                    Turbopack 架构                         │
│                                                         │
│  1. 持久化内容地址存储 (Content-Addressable Store)        │
│     • 每个编译结果按内容哈希存储                           │
│     • 内容不变 → 哈希不变 → 直接复用                      │
│                                                         │
│  2. 细粒度依赖追踪 (Fine-grained Dependency Tracking)     │
│     • 不是文件级别，而是 AST 节点级别                     │
│     • 只重新编译受影响的节点                               │
│                                                         │
│  3. 增量持久化 (Incremental Persistence)                  │
│     • 编译结果持久化到磁盘                                 │
│     • 冷启动时直接加载缓存                                 │
│                                                         │
│  4. 并行编译 (Parallel Compilation)                       │
│     • Rust 原生多线程                                     │
│     • 无锁数据结构 (Tokio)                                │
│                                                         │
│  对比:                                                     │
│  Webpack: 文件级缓存 → 全量重编译 (缓存命中时跳过)         │
│  Turbopack: 节点级缓存 → 精确重编译 (只编译变化节点)       │
└─────────────────────────────────────────────────────────┘
```

---

## 六、构建性能调优实战

### 6.1 Webpack 性能调优 Checklist

```javascript
// webpack.performance.js — 极致性能配置

const path = require('path');
const ForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin');
const TerserPlugin = require('terser-webpack-plugin');
const CssMinimizerPlugin = require('css-minimizer-webpack-plugin');
const { EsbuildPlugin } = require('esbuild-loader');

module.exports = {
  // ============ 1. 使用 esbuild 替代 babel-loader ============
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: {
          loader: 'esbuild-loader',
          options: {
            target: 'es2020',
            jsx: 'automatic',
          },
        },
      },
      // TypeScript 类型检查交给独立进程 (不阻塞编译)
    ],
  },

  // ============ 2. 类型检查异步化 ============
  plugins: [
    new ForkTsCheckerWebpackPlugin({
      async: true,       // 异步检查，不阻塞编译
      typescript: {
        memoryLimit: 4096,
        diagnosticCodes: [1003, 1005, 2304, 2307, 2551],
      },
    }),
  ],

  // ============ 3. 持久化缓存 ============
  cache: {
    type: 'filesystem',
    buildDependencies: { config: [__filename] },
  },

  // ============ 4. 并行压缩 ============
  optimization: {
    minimize: true,
    minimizer: [
      new EsbuildPlugin({ target: 'es2020' }), // esbuild 压缩 (比 Terser 快 10-100x)
      new CssMinimizerPlugin(),
    ],
    // 稳定的模块 ID (提升缓存命中率)
    moduleIds: 'deterministic',
    chunkIds: 'deterministic',
    // 运行时提取
    runtimeChunk: 'single',
    // 代码分割
    splitChunks: {
      chunks: 'all',
      cacheGroups: {
        vendor: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendor',
          chunks: 'all',
        },
        // 大型库单独拆分
        react: {
          test: /[\\/]node_modules[\\/](react|react-dom)[\\/]/,
          name: 'react-vendor',
          chunks: 'all',
        },
      },
    },
  },

  // ============ 5. 排除不需要解析的模块 ============
  resolve: {
    mainFields: ['module', 'main'], // 优先使用 ESM
    extensions: ['.tsx', '.ts', '.jsx', '.js'],
  },

  // ============ 6. 忽略大型 locale 文件 ============
  plugins: [
    new webpack.IgnorePlugin({
      resourceRegExp: /^\.\/locale$/,
      contextRegExp: /moment$/,
    }),
  ],

  // ============ 7.  externals 外部化 ============
  externals: {
    // 通过 CDN 引入的库，不打包
    // 'react': 'React',
    // 'react-dom': 'ReactDOM',
  },
};
```

### 6.2 性能对比数据

```
构建性能对比 (1000 模块 React + TypeScript 项目):

┌─────────────────┬──────────┬──────────┬──────────┬──────────┐
│     指标         │ Webpack  │ Vite     │ esbuild  │ Turbopack│
├─────────────────┼──────────┼──────────┼──────────┼──────────┤
│ 冷启动 (dev)    │  4.2s    │  0.3s    │  0.15s   │  0.1s    │
│ HMR 更新        │  450ms   │  50ms    │  25ms    │  15ms    │
│ 生产构建        │  12s     │  8s      │  1.5s    │  0.8s    │
│ 产物大小        │  280KB   │  275KB   │  295KB   │  270KB   │
│ 内存占用        │  450MB   │  280MB   │  180MB   │  150MB   │
│ 缓存命中启动    │  0.8s    │  0.1s    │  0.05s   │  0.03s   │
└─────────────────┴──────────┴──────────┴──────────┴──────────┘

优化手段效果:

┌───────────────────────────────────┬──────────┬──────────┐
│         优化手段                   │ 优化前   │ 优化后   │
├───────────────────────────────────┼──────────┼──────────┤
│ babel-loader → esbuild-loader     │  4.2s   │  1.8s    │
│ 添加 filesystem cache             │  4.2s   │  0.8s    │
│ ForkTsCheckerWebpackPlugin        │  6.5s   │  4.2s    │
│ Terser → esbuild 压缩             │  12s    │  8s      │
│ splitChunks 优化                  │  350KB  │  280KB   │
│ 组合所有优化                      │  12s    │  2.5s    │
└───────────────────────────────────┴──────────┴──────────┘
```

### 6.3 Bundle 体积优化实战

```javascript
// bundle-optimizer.js — Bundle 体积优化工具

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

class BundleOptimizer {
  constructor(bundlePath) {
    this.bundlePath = bundlePath;
    this.bundle = fs.readFileSync(bundlePath, 'utf-8');
    this.originalSize = Buffer.byteLength(this.bundle);
    this.gzipSize = zlib.gzipSync(this.bundle).length;
  }

  // 分析模块大小分布
  analyzeModules() {
    // 匹配 Webpack 模块格式
    const modulePattern = /"([^"]+)":\s*(?:function|e\(t\))/g;
    const modules = [];
    let match;

    while ((match = modulePattern.exec(this.bundle)) !== null) {
      const moduleName = match[1];
      const start = match.index;

      // 找到模块结束位置 (简单括号匹配)
      let depth = 0;
      let end = start;
      let found = false;
      for (let i = start; i < this.bundle.length; i++) {
        if (this.bundle[i] === '{') depth++;
        if (this.bundle[i] === '}') {
          depth--;
          if (depth === 0) {
            end = i + 1;
            found = true;
            break;
          }
        }
      }

      if (found) {
        const code = this.bundle.slice(start, end);
        modules.push({
          name: moduleName,
          size: Buffer.byteLength(code),
          gzipSize: zlib.gzipSync(code).length,
        });
      }
    }

    modules.sort((a, b) => b.size - a.size);
    return modules;
  }

  // 生成优化建议
  suggestOptimizations(modules) {
    const suggestions = [];

    // 1. 大模块检测
    const largeModules = modules.filter((m) => m.gzipSize > 50 * 1024);
    if (largeModules.length > 0) {
      suggestions.push({
        type: 'code-splitting',
        priority: 'high',
        message: `${largeModules.length} 个模块 gzip 后 > 50KB，建议代码分割`,
        modules: largeModules.map((m) => m.name),
      });
    }

    // 2. 重复代码检测
    const hashGroups = new Map();
    for (const mod of modules) {
      const hash = require('crypto')
        .createHash('md5')
        .update(mod.name)
        .digest('hex')
        .slice(0, 8);
      if (!hashGroups.has(hash)) hashGroups.set(hash, []);
      hashGroups.get(hash).push(mod);
    }

    // 3. 第三方库检测
    const vendorModules = modules.filter((m) =>
      m.name.includes('node_modules')
    );
    const vendorTotal = vendorModules.reduce((sum, m) => sum + m.gzipSize, 0);
    if (vendorTotal > this.gzipSize * 0.6) {
      suggestions.push({
        type: 'vendor-splitting',
        priority: 'high',
        message: `第三方库占 ${((vendorTotal / this.gzipSize) * 100).toFixed(1)}%，建议拆分 vendor chunk`,
      });
    }

    // 4. 未使用导出检测 (简单启发式)
    suggestions.push({
      type: 'tree-shaking',
      priority: 'medium',
      message: '检查是否所有 import 都是必要的，使用 import 按需引入',
    });

    return suggestions;
  }

  // 完整分析报告
  report() {
    const modules = this.analyzeModules();
    const suggestions = this.suggestOptimizations(modules);

    console.log('\n📊 Bundle 分析报告');
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`原始大小: ${(this.originalSize / 1024).toFixed(2)} KB`);
    console.log(`Gzip 大小: ${(this.gzipSize / 1024).toFixed(2)} KB`);
    console.log(`模块数: ${modules.length}`);
    console.log(`\n📦 Top 10 最大模块:`);
    modules.slice(0, 10).forEach((mod, i) => {
      const pct = ((mod.gzipSize / this.gzipSize) * 100).toFixed(1);
      console.log(
        `  ${i + 1}. ${mod.name.slice(0, 50).padEnd(50)} ${(mod.gzipSize / 1024).toFixed(2)} KB (${pct}%)`
      );
    });

    if (suggestions.length > 0) {
      console.log(`\n💡 优化建议:`);
      suggestions.forEach((s, i) => {
        console.log(`  ${i + 1}. [${s.priority.toUpperCase()}] ${s.message}`);
      });
    }

    return { modules, suggestions };
  }
}

// 使用
const optimizer = new BundleOptimizer('./dist/bundle.js');
optimizer.report();
```

---

## 七、Rollup 深度 — 库打包最佳实践

### 7.1 Rollup vs Webpack 选择指南

```
选择指南:

应用 (Application) → Webpack / Vite
  • 需要代码分割 (路由级、组件级)
  • 需要动态 import
  • 需要 HMR
  • 需要处理 CSS/图片等静态资源
  • 需要复杂的 loader 管道

库 (Library) → Rollup / esbuild
  • 需要多种输出格式 (ESM/CJS/UMD/IIFE)
  • 需要 Tree Shaking (对消费者友好)
  • 需要 Side Effects 标注
  • 不需要代码分割 (库通常是单个文件)
  • 需要干净的输出 (无运行时开销)
```

### 7.2 Rollup 库打包配置

```javascript
// rollup.config.js — 库打包最佳实践

import typescript from '@rollup/plugin-typescript';
import { terser } from 'rollup-plugin-terser';
import peerDepsExternal from 'rollup-plugin-peer-deps-external';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import replace from '@rollup/plugin-replace';
import visualizer from 'rollup-plugin-visualizer';

const packageJson = require('./package.json');

export default {
  input: 'src/index.ts',
  output: [
    // ESM — 现代打包工具首选 (支持 Tree Shaking)
    {
      file: packageJson.module,
      format: 'esm',
      sourcemap: true,
    },
    // CommonJS — Node.js 和旧工具兼容
    {
      file: packageJson.main,
      format: 'cjs',
      sourcemap: true,
      exports: 'named',
    },
    // UMD — 浏览器直接引入
    {
      file: packageJson.browser,
      format: 'umd',
      name: 'MyLibrary',
      globals: {
        react: 'React',
        'react-dom': 'ReactDOM',
      },
      sourcemap: true,
    },
  ],
  plugins: [
    // 自动排除 peerDependencies
    peerDepsExternal(),
    // 解析 node_modules
    resolve(),
    // CJS → ESM 转换
    commonjs(),
    // TypeScript
    typescript({ tsconfig: './tsconfig.json' }),
    // 环境变量替换
    replace({
      'process.env.NODE_ENV': JSON.stringify('production'),
      preventAssignment: true,
    }),
    // 压缩 (仅生产)
    process.env.NODE_ENV === 'production' && terser(),
    // 可视化分析
    visualizer({
      filename: 'dist/stats.html',
      gzipSize: true,
    }),
  ],
  // 外部化 (不打包进产物)
  external: ['react', 'react-dom'],
};
```

```json
// package.json — 库的 package.json 最佳实践
{
  "name": "my-library",
  "version": "1.0.0",
  "main": "dist/index.cjs.js",
  "module": "dist/index.esm.js",
  "browser": "dist/index.umd.js",
  "types": "dist/index.d.ts",
  "sideEffects": false,
  "exports": {
    ".": {
      "import": "./dist/index.esm.js",
      "require": "./dist/index.cjs.js",
      "types": "./dist/index.d.ts"
    },
    "./package.json": "./package.json"
  },
  "files": [
    "dist"
  ],
  "peerDependencies": {
    "react": ">=16.8.0",
    "react-dom": ">=16.8.0"
  },
  "devDependencies": {
    "react": "^18.0.0",
    "react-dom": "^18.0.0"
  }
}
```

---

## 八、Rspack — 新一代构建工具

### 8.1 Rspack 简介

Rspack 是由 ByteDance 开发的基于 Rust 的模块打包器，兼容 Webpack 生态。

```
Rspack 核心特性:

┌─────────────────────────────────────────────────────────┐
│  • Rust 编写 — 编译速度比 Webpack 快 5-10 倍            │
│  • Webpack 兼容 — 可直接使用 Webpack Loader/Plugin      │
│  • 持久化缓存 — 文件系统级缓存，冷启动快                  │
│  • 增量编译 — 只编译变化的模块                           │
│  • Tree Shaking — 基于 ESM 的死代码消除                  │
│  • Code Splitting — 自动代码分割                        │
│  • HMR — 极速热更新                                     │
│                                                         │
│  架构:                                                   │
│  ┌─────────────┐    ┌─────────────┐                     │
│  │  JavaScript  │←→ │    Rust     │                     │
│  │  (API 层)    │    │  (核心引擎)  │                     │
│  │  • Loader   │    │  • 解析器    │                     │
│  │  • Plugin   │    │  • 编译器    │                     │
│  │  • Config   │    │  • 优化器    │                     │
│  └─────────────┘    └─────────────┘                     │
│                                                         │
│  性能数据 (1000 模块项目):                                │
│  • 冷启动: Webpack 4.2s → Rspack 0.5s (8x 快)           │
│  • HMR: Webpack 450ms → Rspack 50ms (9x 快)             │
│  • 生产构建: Webpack 12s → Rspack 2s (6x 快)            │
└─────────────────────────────────────────────────────────┘
```

### 8.2 Rspack 配置示例

```javascript
// rspack.config.js — Rspack 配置 (兼容 Webpack)

const { rspack } = require('@rspack/core');

module.exports = {
  entry: './src/index.tsx',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].[contenthash:8].js',
    clean: true,
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: [
          {
            loader: 'builtin:swc-loader',
            options: {
              jsc: {
                parser: {
                  syntax: 'typescript',
                  tsx: true,
                },
                transform: {
                  react: {
                    runtime: 'automatic',
                  },
                },
              },
            },
          },
        ],
      },
      {
        test: /\.css$/,
        type: 'css/module',
      },
    ],
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.jsx', '.js'],
  },
  plugins: [
    new rspack.HtmlRspackPlugin({
      template: './public/index.html',
    }),
    // 使用 Webpack 插件 (兼容性)
    // new webpack.DefinePlugin({ ... }),
  ],
  optimization: {
    moduleIds: 'deterministic',
    chunkIds: 'deterministic',
    splitChunks: {
      chunks: 'all',
    },
  },
  devServer: {
    port: 3000,
    hot: true,
  },
};
```

---

## 九、综合实战 — 从零搭建现代构建系统

### 9.1 项目结构

```
modern-build-system/
├── src/
│   ├── index.tsx
│   ├── components/
│   ├── utils/
│   └── styles/
├── build/
│   ├── compiler.js          # 核心编译器
│   ├── tapable.js           # 钩子系统
│   ├── plugins/
│   │   ├── banner.js
│   │   ├── html.js
│   │   ├── clean.js
│   │   └── stats.js
│   └── utils/
│       ├── resolver.js      # 模块解析器
│       ├── transformer.js   # 代码转换器
│       └── optimizer.js     # 优化器
├── dist/
├── .build-cache/
├── package.json
└── build.config.js
```

### 9.2 构建配置

```javascript
// build.config.js
module.exports = {
  context: process.cwd(),
  entry: './src/index.tsx',
  output: {
    path: './dist',
    filename: 'bundle.[contenthash:8].js',
  },
  devServer: {
    port: 3000,
    hmr: true,
    proxy: {
      '/api': 'http://localhost:8080',
    },
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.jsx', '.js'],
    alias: {
      '@': './src',
      '@components': './src/components',
      '@utils': './src/utils',
    },
  },
  optimize: {
    treeShaking: true,
    minify: true,
    splitChunks: true,
    contentHash: true,
  },
  plugins: [
    require('./build/plugins/clean'),
    require('./build/plugins/html'),
    require('./build/plugins/banner'),
    require('./build/plugins/stats'),
  ],
};
```

### 9.3 模块解析器

```javascript
// build/utils/resolver.js — 模块解析器

const fs = require('fs');
const path = require('path');

class Resolver {
  constructor(options = {}) {
    this.extensions = options.extensions || ['.tsx', '.ts', '.jsx', '.js', '.json'];
    this.alias = options.alias || {};
    this.mainFields = options.mainFields || ['module', 'main'];
    this.modules = options.modules || ['node_modules'];
  }

  // 解析模块路径
  resolve(fromPath, importSource) {
    // 1. 别名替换
    let source = importSource;
    for (const [key, value] of Object.entries(this.alias)) {
      if (source === key || source.startsWith(key + '/')) {
        source = path.resolve(process.cwd(), value, source.slice(key.length));
        break;
      }
    }

    // 2. 相对/绝对路径
    if (source.startsWith('.') || source.startsWith('/')) {
      return this.resolveFile(fromPath, source);
    }

    // 3. node_modules 解析
    return this.resolveNodeModule(fromPath, source);
  }

  // 文件解析 (尝试扩展名)
  resolveFile(fromPath, source) {
    const dir = path.dirname(fromPath);
    const basePath = path.resolve(dir, source);

    // 精确匹配
    if (fs.existsSync(basePath) && fs.statSync(basePath).isFile()) {
      return basePath;
    }

    // 尝试扩展名
    for (const ext of this.extensions) {
      const fullPath = basePath + ext;
      if (fs.existsSync(fullPath)) return fullPath;
    }

    // 目录 → index
    if (fs.existsSync(basePath) && fs.statSync(basePath).isDirectory()) {
      for (const ext of this.extensions) {
        const indexPath = path.join(basePath, 'index' + ext);
        if (fs.existsSync(indexPath)) return indexPath;
      }
    }

    return null;
  }

  // node_modules 解析
  resolveNodeModule(fromPath, packageName) {
    let current = path.dirname(fromPath);
    const root = path.parse(current).root;

    while (current !== root) {
      const nodeModules = path.join(current, 'node_modules');
      const packagePath = path.join(nodeModules, packageName);

      if (fs.existsSync(packagePath)) {
        const pkgJson = path.join(packagePath, 'package.json');
        if (fs.existsSync(pkgJson)) {
          const pkg = JSON.parse(fs.readFileSync(pkgJson, 'utf-8'));
          for (const field of this.mainFields) {
            if (pkg[field]) {
              const resolved = path.join(packagePath, pkg[field]);
              if (fs.existsSync(resolved)) return resolved;
            }
          }
          // 默认 index
          for (const ext of this.extensions) {
            const indexPath = path.join(packagePath, 'index' + ext);
            if (fs.existsSync(indexPath)) return indexPath;
          }
        }
      }

      current = path.dirname(current);
    }

    return null;
  }
}

module.exports = Resolver;
```

---

## 十、知识体系总结

### 10.1 构建工具全景图

```
构建工具生态
│
├── 模块打包器
│   ├── Webpack — 配置驱动，生态最全
│   ├── Vite — 原生 ESM + Rollup/esbuild，开发体验最佳
│   ├── Rollup — 库打包首选，ESM 优先
│   ├── esbuild — Go 编写，极致性能
│   ├── Rspack — Rust 编写，Webpack 兼容
│   └── Turbopack — Rust 编写，增量编译
│
├── 核心原理
│   ├── AST 解析 (acorn / @babel/parser / swc)
│   ├── 依赖图构建 (BFS/DFS)
│   ├── 代码转换 (Babel / SWC / esbuild)
│   ├── 模块系统 (CommonJS / ESM / AMD / UMD)
│   ├── 打包输出 (IIFE / CJS / ESM / UMD)
│   └── 优化技术 (Tree Shaking / Code Splitting / Minification)
│
├── 开发体验
│   ├── HMR (WebSocket + 模块替换)
│   ├── Source Map (inline / external / eval)
│   ├── DevServer (静态服务 + 代理)
│   ├── Error Overlay (编译错误覆盖层)
│   └── 热更新策略 (全量替换 / 局部替换 / 状态保留)
│
├── 生产优化
│   ├── Tree Shaking (ESM 静态分析)
│   ├── Code Splitting (路由级 / 组件级 / vendor)
│   ├── Minification (Terser / esbuild / SWC)
│   ├── Compression (gzip / brotli)
│   ├── Cache Strategy (contenthash / runtime chunk)
│   ├── Scope Hoisting (模块合并)
│   └── Bundle Analysis (webpack-bundle-analyzer)
│
├── 插件系统
│   ├── Tapable (Webpack Hook 系统)
│   ├── Loader (文件转换管道)
│   ├── Plugin (编译生命周期钩子)
│   ├── Vite Plugin (Rollup 插件 + 服务端钩子)
│   └── esbuild Plugin (onResolve / onLoad)
│
├── 高级特性
│   ├── Module Federation (运行时模块共享)
│   ├── 持久化缓存 (filesystem cache)
│   ├── 增量编译 (只编译变化部分)
│   ├── 并行编译 (多线程 / 多进程)
│   └── 微前端 (qiankun / single-spa / Module Federation)
│
└── 手写实现
    ├── 模块解析器 (路径解析 + 扩展名 + node_modules)
    ├── AST 解析器 (import/require 识别)
    ├── 依赖图构建 (BFS 遍历)
    ├── 代码转换器 (Babel / 正则)
    ├── 打包生成器 (IIFE + 模块系统)
    ├── Tree Shaker (可达性分析)
    ├── HMR 系统 (WebSocket + 模块替换)
    └── 缓存系统 (文件哈希 + 增量编译)
```

### 10.2 学习路径建议

```
构建工具学习路径:

Level 1 — 基础使用
  ✓ Webpack 基础配置
  ✓ Vite 项目搭建
  ✓ 常用 Loader/Plugin

Level 2 — 进阶配置
  ✓ 代码分割策略
  ✓ Tree Shaking 原理
  ✓ HMR 配置与原理
  ✓ 性能优化调优

Level 3 — 插件开发
  ✓ Webpack Plugin 开发
  ✓ Vite Plugin 开发
  ✓ esbuild Plugin 开发
  ✓ Tapable 钩子系统

Level 4 — 内核理解
  ✓ 手写简易 Bundler
  ✓ 手写 Compiler + Plugin 系统
  ✓ Module Federation 原理
  ✓ 增量编译与缓存

Level 5 — 架构设计
  ✓ 构建工具选型
  ✓ 微前端构建方案
  ✓ 多框架统一构建
  ✓ 构建性能监控体系
```

---

## 十一、实战练习

### 练习 1: 手写完整 Compiler
- [ ] 实现 Tapable 钩子系统 (SyncHook / AsyncHook / Waterfall)
- [ ] 实现 Compiler 核心 (entry → build → emit)
- [ ] 实现 Plugin 系统 (生命周期钩子)
- [ ] 实现 Loader 管道 (从右到左执行)

### 练习 2: 开发 Vite 插件
- [ ] Markdown 组件插件 (.md → React Component)
- [ ] SVG Sprite 插件 (自动生成 + 注入)
- [ ] 环境变量插件 (.env 文件解析)
- [ ] 图片优化插件 (WebP 转换 + srcset)

### 练习 3: Module Federation 实战
- [ ] 搭建 Host + 2 个 Remote 的微前端架构
- [ ] 实现共享依赖 (React/Vue 版本协商)
- [ ] 实现运行时动态加载
- [ ] 处理样式隔离问题

### 练习 4: 构建性能调优
- [ ] 对比 Webpack / Vite / esbuild 在同一项目的性能
- [ ] 实现持久化缓存
- [ ] 实现增量编译
- [ ] 生成 Bundle 分析报告

---

*训练材料版本：3.0 (进阶版) | 创建日期：2026-04-30*  
*前置材料：`build-tools-1400.md` (基础版)*
