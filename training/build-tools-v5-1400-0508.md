# 🔧 构建工具专项 v5 — 工程化实战：插件开发 + 迁移策略 + Bundle 分析 + CSS 管线 + CI/CD 流水线

**时间：** 2026-05-08 14:00  
**前置：** `build-tools-1400.md` (基础) + `build-tools-advanced-1400-0430.md` (进阶) + `build-tools-v3-1400-0502.md` (现代生态) + `build-tools-v4-1400-0506.md` (算法内核)  
**差异化：** 前 4 轮覆盖原理/架构/生态/算法，v5 聚焦 **工程化实战** — 手写插件系统、Webpack→Vite 迁移、Bundle 可视化分析、CSS 管线架构、CI/CD 构建流水线优化

---

## 一、手写插件系统 — 从 Webpack/Rollup/Vite 抽象出通用插件架构

### 1.1 三大插件体系对比

```
插件体系的核心差异:

┌──────────────┬──────────────────┬──────────────────┬──────────────────┐
│ 特性          │ Webpack          │ Rollup           │ Vite             │
├──────────────┼──────────────────┼──────────────────┼──────────────────┤
│ 钩子模型       │ Tapable (同步/   │ 异步钩子          │ Rollup 兼容 +    │
│              │ 异步/并行)       │ (串行/并行)       │ 开发/构建双阶段  │
│ 钩子数量       │ 40+              │ 15               │ 25+              │
│ 模块处理       │ Loader (链式)    │ Transform (管道) │ Transform (管道) │
│ 资源管理       │ Compilation.assets│ this.emitFile()  │ this.emitFile()  │
│ 依赖追踪       │ this.addDep()    │ this.addWatchFile│ this.addWatchFile│
│ 热更新         │ HotModuleReplace │ N/A (Rollup)     │ import.meta.hot  │
│ 插件通信       │ Compiler hooks   │ buildEnd/buildStart│ closeBundle     │
└──────────────┴──────────────────┴──────────────────┴──────────────────┘

核心洞察:
1. Webpack 插件体系最庞大但最复杂 — Tapable 有 7 种 Hook 类型
2. Rollup 插件体系最简洁 — 15 个钩子覆盖全部场景
3. Vite 插件体系最灵活 — 兼容 Rollup + 双阶段 (dev/build) + HMR
4. 现代趋势: Rollup 风格成为事实标准 (Vite/Rolldown/Rspack 都兼容)
```

### 1.2 手写通用插件系统 — 兼容三种风格

```javascript
// universal-plugin-system.js — 从零实现通用插件系统

const { EventEmitter } = require('events');

// ========== Hook 系统 (Tapable 风格) ==========

class Hook {
  constructor(args = []) {
    this.args = args;
    this.taps = [];
  }

  tap(name, fn) {
    this.taps.push({ name, fn, type: 'sync' });
  }

  tapAsync(name, fn) {
    this.taps.push({ name, fn, type: 'async' });
  }

  tapPromise(name, fn) {
    this.taps.push({ name, fn, type: 'promise' });
  }
}

class SyncHook extends Hook {
  call(...args) {
    for (const tap of this.taps) {
      tap.fn(...args);
    }
  }
}

class SyncWaterfallHook extends Hook {
  call(...args) {
    let [first, ...rest] = args;
    for (const tap of this.taps) {
      first = tap.fn(first, ...rest);
    }
    return first;
  }
}

class SyncBailHook extends Hook {
  call(...args) {
    for (const tap of this.taps) {
      const result = tap.fn(...args);
      if (result !== undefined) return result;
    }
    return null;
  }
}

class AsyncParallelHook extends Hook {
  async call(...args) {
    await Promise.all(this.taps.map(tap => tap.fn(...args)));
  }
}

class AsyncSeriesHook extends Hook {
  async call(...args) {
    for (const tap of this.taps) {
      await tap.fn(...args);
    }
  }
}

class HookMap {
  constructor(createHook) {
    this._hooks = new Map();
    this._createHook = createHook;
  }

  get(key) {
    if (!this._hooks.has(key)) {
      this._hooks.set(key, this._createHook(key));
    }
    return this._hooks.get(key);
  }
}

// ========== Compiler 核心 ==========

class Compiler {
  constructor(options = {}) {
    this.options = options;
    this.context = options.context || process.cwd();
    this.modules = new Map();
    this.assets = new Map();
    this.chunks = new Map();
    this.hooks = {
      // 编译生命周期 (Webpack 风格)
      initialize: new SyncHook([]),
      beforeCompile: new SyncHook([]),
      compile: new SyncHook(['params']),
      afterCompile: new AsyncSeriesHook(['compilation']),
      emit: new AsyncSeriesHook(['compilation']),
      afterEmit: new SyncHook(['compilation']),
      done: new SyncBailHook(['stats']),
      failed: new SyncHook(['errors']),

      // 模块处理 (Rollup/Vite 风格)
      resolveId: new SyncBailHook(['source', 'importer']),
      load: new SyncBailHook(['id']),
      transform: new SyncWaterfallHook(['code', 'id']),
      buildStart: new SyncHook([]),
      buildEnd: new SyncHook(['error']),

      // 文件输出
      renderStart: new SyncHook([]),
      renderChunk: new SyncWaterfallHook(['code', 'chunkId']),
      generateBundle: new SyncHook(['bundle']),
      writeBundle: new SyncHook(['bundle']),
    };

    this.plugins = [];
  }

  use(plugin) {
    if (typeof plugin === 'function') {
      plugin(this);
    } else if (plugin && typeof plugin.apply === 'function') {
      plugin.apply(this);
    }
    this.plugins.push(plugin);
    return this;
  }

  async compile() {
    this.hooks.initialize.call();
    this.hooks.buildStart.call();
    this.hooks.beforeCompile.call();

    try {
      // 1. 解析入口
      const entry = this.options.entry || './src/index.js';
      const entryModule = await this.resolveModule(entry);

      // 2. 构建依赖图
      await this.buildGraph(entryModule);

      // 3. 转换模块
      await this.transformModules();

      // 4. 生成产物
      this.hooks.renderStart.call();
      await this.generateChunks();

      // 5. 输出产物
      this.hooks.emit.call({
        modules: this.modules,
        assets: this.assets,
        chunks: this.chunks,
      });

      this.hooks.afterEmit.call({
        modules: this.modules,
        assets: this.assets,
        chunks: this.chunks,
      });

      this.hooks.buildEnd.call(null);

      return {
        modules: this.modules.size,
        assets: this.assets.size,
        chunks: this.chunks.size,
        duration: Date.now(),
      };
    } catch (error) {
      this.hooks.buildEnd.call(error);
      this.hooks.failed.call([error]);
      throw error;
    }
  }

  async resolveModule(source, importer = null) {
    // 插件钩子: resolveId
    const resolved = this.hooks.resolveId.call(source, importer);
    if (resolved) return resolved;

    // 默认解析逻辑
    const path = require('path');
    const fs = require('fs');

    if (source.startsWith('.') || source.startsWith('/')) {
      const baseDir = importer
        ? path.dirname(importer)
        : this.context;
      let resolvedPath = path.resolve(baseDir, source);

      // 尝试扩展名
      for (const ext of ['.js', '.jsx', '.ts', '.tsx', '.mjs', '.json']) {
        if (fs.existsSync(resolvedPath + ext)) {
          return resolvedPath + ext;
        }
      }
      if (fs.existsSync(path.join(resolvedPath, 'index.js'))) {
        return path.join(resolvedPath, 'index.js');
      }
      return resolvedPath;
    }

    // node_modules 解析 (简化)
    return source;
  }

  async loadModule(id) {
    // 插件钩子: load
    const loaded = this.hooks.load.call(id);
    if (loaded) return loaded;

    const fs = require('fs');
    return fs.readFileSync(id, 'utf-8');
  }

  async transformModule(code, id) {
    return this.hooks.transform.call(code, id);
  }

  async buildGraph(entryModule) {
    const queue = [entryModule];
    const visited = new Set();

    while (queue.length > 0) {
      const current = queue.shift();
      if (visited.has(current)) continue;
      visited.add(current);

      const source = await this.loadModule(current);
      const transformed = await this.transformModule(source, current);

      // 提取依赖
      const deps = this.extractDependencies(transformed);

      this.modules.set(current, {
        id: current,
        source,
        transformed,
        dependencies: deps,
      });

      for (const dep of deps) {
        const resolved = await this.resolveModule(dep, current);
        if (resolved && !visited.has(resolved)) {
          queue.push(resolved);
        }
      }
    }
  }

  extractDependencies(code) {
    const deps = [];
    // ESM
    const esmRe = /import\s+(?:[\s\S]*?\s+from\s+)?['"]([^'"]+)['"]/g;
    let m;
    while ((m = esmRe.exec(code)) !== null) deps.push(m[1]);
    // Dynamic import
    const dynRe = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
    while ((m = dynRe.exec(code)) !== null) deps.push(m[1]);
    // CJS
    const cjsRe = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
    while ((m = cjsRe.exec(code)) !== null) deps.push(m[1]);
    return [...new Set(deps)];
  }

  async transformModules() {
    // 所有模块已通过 buildGraph 中的 transform 处理
  }

  async generateChunks() {
    const modules = Array.from(this.modules.values());

    // 生成 bundle
    const bundle = this.generateBundle(modules);
    this.assets.set('bundle.js', {
      source: bundle,
      size: Buffer.byteLength(bundle, 'utf-8'),
    });

    this.chunks.set('main', {
      id: 'main',
      files: ['bundle.js'],
      modules: modules.map(m => m.id),
    });

    this.hooks.renderChunk.call(bundle, 'main');
    this.hooks.generateBundle.call(Object.fromEntries(this.assets));
  }

  generateBundle(modules) {
    const moduleMap = {};
    let idCounter = 0;
    const idMap = new Map();

    for (const mod of modules) {
      const id = idCounter++;
      idMap.set(mod.id, id);
      const deps = {};
      for (const dep of mod.dependencies) {
        const resolved = this.modules.get(dep);
        if (resolved) {
          deps[dep] = idCounter; // 占位，实际应遍历后赋值
        }
      }
      // 简化: 直接包裹
      moduleMap[id] = [
        `function(require, module, exports) { ${mod.transformed} }`,
        JSON.stringify(deps),
      ];
    }

    return `
(function(modules) {
  var cache = {};
  function require(id) {
    if (cache[id]) return cache[id].exports;
    var module = { exports: {} };
    cache[id] = module;
    modules[id][0].call(module.exports, require, module, module.exports);
    return module.exports;
  }
  require(0);
})(${JSON.stringify(moduleMap)});
`.trim();
  }

  async run() {
    const start = Date.now();
    const stats = await this.compile();
    stats.duration = Date.now() - start;
    this.hooks.done.call(stats);
    return stats;
  }
}

// ========== 插件示例 ==========

// 示例 1: Webpack 风格插件 — BannerPlugin
class BannerPlugin {
  constructor(options = { banner: 'Built with Universal Bundler' }) {
    this.options = options;
  }

  apply(compiler) {
    compiler.hooks.emit.tapAsync('BannerPlugin', (compilation, callback) => {
      for (const [name, asset] of compilation.assets) {
        if (name.endsWith('.js')) {
          asset.source = this.options.banner + '\n' + asset.source;
          asset.size = Buffer.byteLength(asset.source, 'utf-8');
        }
      }
      callback();
    });
  }
}

// 示例 2: Rollup/Vite 风格插件 — Alias
function aliasPlugin(aliases) {
  return {
    name: 'alias',
    resolveId(source, importer) {
      for (const [find, replace] of Object.entries(aliases)) {
        if (source === find || source.startsWith(find + '/')) {
          return source.replace(find, replace);
        }
      }
      return null;
    },
  };
}

// 示例 3: Vite 风格插件 — Markdown
function markdownPlugin() {
  return {
    name: 'markdown',
    enforce: 'pre', // 优先执行
    transform(code, id) {
      if (!id.endsWith('.md')) return null;

      // 简化: 将 Markdown 转为 JS 模块
      const content = code
        .replace(/`/g, '\\`')
        .replace(/\$/g, '\\$');

      return {
        code: `export default \`${content}\`;`,
        map: null,
      };
    },
  };
}

// 示例 4: 自定义插件 — 环境变量注入
function envPlugin(env = {}) {
  return {
    name: 'env',
    transform(code, id) {
      if (id.includes('node_modules')) return null;

      let result = code;
      for (const [key, value] of Object.entries(env)) {
        const regex = new RegExp(`\\b${key}\\b`, 'g');
        result = result.replace(regex, JSON.stringify(value));
      }
      return { code: result };
    },
  };
}

// ========== 使用示例 ==========

const compiler = new Compiler({
  entry: './src/index.js',
  context: process.cwd(),
});

// 注册插件 (混合风格)
compiler.use(new BannerPlugin({ banner: '/* My App v1.0 */' }));
compiler.use(aliasPlugin({ '@': './src', '~': './node_modules' }));
compiler.use(markdownPlugin());
compiler.use(envPlugin({
  'process.env.NODE_ENV': JSON.stringify('production'),
  '__APP_VERSION__': JSON.stringify('1.0.0'),
}));

// 监听生命周期
compiler.hooks.done.tap('Logger', (stats) => {
  console.log(`✅ Build done: ${stats.modules} modules, ${stats.duration}ms`);
});

compiler.hooks.failed.tap('Logger', (errors) => {
  console.error('❌ Build failed:', errors);
});

// 执行编译
// compiler.run();

console.log('✅ Universal Plugin System 实现完成');
console.log('   - Hook 系统: SyncHook, SyncWaterfall, SyncBail, AsyncParallel, AsyncSeries');
console.log('   - 插件风格: Webpack (apply), Rollup (resolveId/load/transform), Vite (enforce)');
console.log('   - 示例插件: BannerPlugin, Alias, Markdown, Env');
```

### 1.3 插件开发最佳实践

```
插件开发 Checklist:

┌─────────────────────────────────────────────────────┐
│ 1. 确定插件类型                                      │
│    ├── Loader 型: 转换代码 (transform)               │
│    ├── Resolver 型: 解析路径 (resolveId)             │
│    ├── Analyzer 型: 分析产物 (emit/generateBundle)   │
│    └── Optimizer 型: 优化产物 (renderChunk)          │
│                                                     │
│ 2. 选择正确的钩子                                    │
│    ├── 修改源码 → transform                          │
│    ├── 解析路径 → resolveId                          │
│    ├── 加载内容 → load                               │
│    ├── 修改产物 → renderChunk / emit                 │
│    └── 输出后处理 → writeBundle / afterEmit          │
│                                                     │
│ 3. 性能优化                                          │
│    ├── 缓存: 对相同输入返回相同输出                    │
│    ├── 跳过: node_modules 默认跳过                   │
│    ├── 并行: 使用 AsyncParallelHook                  │
│    └── 懒加载: 只在需要时处理                        │
│                                                     │
│ 4. 错误处理                                          │
│    ├── transform 失败 → 返回 null (让下一个插件处理)  │
│    ├── 致命错误 → throw Error (带文件名和行号)        │
│    └── 警告 → 使用 compiler.warnings 而非 throw      │
│                                                     │
│ 5. 兼容性                                            │
│    ├── 同时支持 Vite 和 Rollup                       │
│    ├── 提供 name 字段 (用于调试)                     │
│    └── 提供 enforce 字段 (pre/post)                  │
└─────────────────────────────────────────────────────┘
```

---

## 二、Webpack → Vite 迁移实战

### 2.1 迁移决策矩阵

```
何时应该迁移 Webpack → Vite:

✅ 适合迁移:
├── 项目使用 Vue/React/Svelte (Vite 官方支持)
├── 开发服务器启动 > 5 秒
├── HMR 延迟 > 500ms
├── 不需要 Webpack 特有插件 (DLL/ModuleFederation)
├── 项目规模 < 5000 模块
└── 团队愿意接受配置差异

❌ 不适合迁移:
├── 重度依赖 Webpack Loader (raw-loader, file-loader 等)
├── 使用 Module Federation (微前端)
├── 使用 DLLPlugin (预编译)
├── 自定义复杂插件链
├── 需要 CommonJS 完整兼容
└── 项目规模 > 10000 模块 (Vite 预构建可能慢)

迁移成本估算:
┌─────────────────────────────────────────────────────┐
│ 项目规模    │ 配置重写 │ 插件替换 │ 测试验证 │ 总工时 │
├─────────────────────────────────────────────────────┤
│ < 100 模块  │ 0.5 天   │ 0.5 天    │ 0.5 天   │ 1.5 天 │
│ 100-500 模块│ 1 天     │ 1 天      │ 1 天     │ 3 天   │
│ 500-2000    │ 2 天     │ 2 天      │ 2 天     │ 6 天   │
│ > 2000 模块 │ 3-5 天   │ 3-5 天    │ 3-5 天   │ 9-15 天│
└─────────────────────────────────────────────────────┘
```

### 2.2 配置映射表

```
Webpack → Vite 配置映射:

┌──────────────────────────────────────────────────────────────┐
│ Webpack                      │ Vite                         │
├──────────────────────────────────────────────────────────────┤
│ entry: { app: './src/main' } │ build.rollupOptions.input    │
│ output.path: './dist'        │ build.outDir: './dist'       │
│ output.filename: '[name].js' │ build.rollupOptions.output    │
│ resolve.alias: { '@': 'src' }│ resolve.alias: { '@': 'src' }│
│ resolve.extensions: [...]    │ resolve.extensions (默认)    │
│ module.rules: [...]          │ esbuild / plugins.transform  │
│ plugins: [...]               │ plugins: [...]               │
│ devServer.port: 3000         │ server.port: 3000            │
│ devServer.proxy: {...}       │ server.proxy: {...}          │
│ devServer.hot: true          │ server.hmr: true (默认)      │
│ optimization.splitChunks     │ build.rollupOptions.output   │
│ optimization.minimize        │ build.minify: 'esbuild'      │
│ optimization.moduleIds       │ build.rollupOptions.output   │
│ css-loader                   │ 内置 (无需配置)              │
│ style-loader                 │ 内置 (自动注入)              │
│ vue-loader                   │ @vitejs/plugin-vue           │
│ babel-loader                 │ 内置 esbuild / @vitejs/plugin│
│ terser-webpack-plugin        │ build.minify: 'terser'       │
│ html-webpack-plugin          │ 内置 index.html 入口         │
│ copy-webpack-plugin          │ rollup-plugin-copy           │
│ clean-webpack-plugin         │ build.emptyOutDir: true      │
│ definePlugin                 │ define: {...}                │
│ ProvidePlugin                │ 手动 import / 插件           │
│ DllPlugin                    │ 不需要 (Vite 开发模式快)     │
│ ModuleFederationPlugin       │ 不支持 (用 vite-federation)  │
└──────────────────────────────────────────────────────────────┘
```

### 2.3 完整迁移示例 — Vue 2 + Webpack → Vue 3 + Vite

```javascript
// ===== Webpack 配置 (迁移前) =====
// webpack.config.js

const path = require('path');
const { DefinePlugin } = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const { VueLoaderPlugin } = require('vue-loader');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = {
  entry: './src/main.js',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'js/[name].[contenthash:8].js',
    chunkFilename: 'js/[name].[contenthash:8].chunk.js',
    publicPath: '/',
    clean: true,
  },
  resolve: {
    extensions: ['.js', '.vue', '.json'],
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '~': path.resolve(__dirname, 'node_modules'),
      vue$: 'vue/dist/vue.runtime.esm.js',
    },
  },
  module: {
    rules: [
      {
        test: /\.vue$/,
        loader: 'vue-loader',
      },
      {
        test: /\.js$/,
        loader: 'babel-loader',
        include: path.resolve(__dirname, 'src'),
        options: {
          presets: ['@babel/preset-env'],
          plugins: ['@babel/plugin-transform-runtime'],
        },
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader', 'postcss-loader'],
      },
      {
        test: /\.scss$/,
        use: ['style-loader', 'css-loader', 'postcss-loader', 'sass-loader'],
      },
      {
        test: /\.(png|jpe?g|gif|svg)$/,
        loader: 'url-loader',
        options: { limit: 8192, name: 'img/[name].[hash:8].[ext]' },
      },
      {
        test: /\.(woff2?|eot|ttf|otf)$/,
        loader: 'file-loader',
        options: { name: 'fonts/[name].[hash:8].[ext]' },
      },
    ],
  },
  plugins: [
    new VueLoaderPlugin(),
    new HtmlWebpackPlugin({
      template: 'public/index.html',
      favicon: 'public/favicon.ico',
    }),
    new DefinePlugin({
      'process.env.NODE_ENV': JSON.stringify('production'),
      'process.env.VUE_APP_VERSION': JSON.stringify('1.0.0'),
    }),
    new CopyWebpackPlugin({
      patterns: [{ from: 'public', to: '', globOptions: { ignore: ['**/index.html'] } }],
    }),
  ],
  optimization: {
    splitChunks: {
      chunks: 'all',
      cacheGroups: {
        vendor: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendors',
        },
      },
    },
    minimizer: [new (require('terser-webpack-plugin'))()],
  },
  devServer: {
    port: 8080,
    hot: true,
    historyApiFallback: true,
    proxy: {
      '/api': { target: 'http://localhost:3000', changeOrigin: true },
    },
  },
};

// ===== Vite 配置 (迁移后) =====
// vite.config.js

import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'path';

export default defineConfig({
  plugins: [vue()],

  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '~': resolve(__dirname, 'node_modules'),
    },
    extensions: ['.js', '.vue', '.json', '.mjs'],
  },

  // CSS 预处理 — 无需 loader，直接配置
  css: {
    preprocessorOptions: {
      scss: {
        additionalData: `@use "@/styles/variables" as *;`, // 全局变量注入
      },
    },
  },

  // 开发服务器 — 等价于 devServer
  server: {
    port: 8080,
    hmr: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        rewrite: (path) => path, // Vite 默认不重写
      },
    },
    fs: {
      allow: ['..'], // 允许访问上级目录
    },
  },

  // 构建配置 — 等价于 output + optimization
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true,
    minify: 'esbuild', // 比 terser 快 20-40x
    cssCodeSplit: true, // 等价于 splitChunks.css

    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
      },
      output: {
        // 等价于 output.filename/chunkFilename
        entryFileNames: 'js/[name].[hash:8].js',
        chunkFileNames: 'js/[name].[hash:8].chunk.js',
        assetFileNames: (assetInfo) => {
          const name = assetInfo.name || '';
          if (/\.(png|jpe?g|gif|svg)$/.test(name)) return 'img/[name].[hash:8][extname]';
          if (/\.(woff2?|eot|ttf|otf)$/.test(name)) return 'fonts/[name].[hash:8][extname]';
          if (/\.css$/.test(name)) return 'css/[name].[hash:8][extname]';
          return 'assets/[name].[hash:8][extname]';
        },
        // 等价于 splitChunks.cacheGroups
        manualChunks: {
          vue: ['vue', 'vue-router', 'pinia'],
          vendor: id => id.includes('node_modules') ? 'vendor' : null,
        },
      },
    },

    // 性能预算
    chunkSizeWarningLimit: 500,
  },

  // 等价于 DefinePlugin
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
    'process.env.VUE_APP_VERSION': JSON.stringify('1.0.0'),
  },

  // 静态资源 — 等价于 CopyWebpackPlugin
  publicDir: 'public', // 自动复制到 dist/
});
```

### 2.4 迁移 Checklist

```
Webpack → Vite 迁移 Checklist:

Phase 1: 准备
├── [ ] 安装 Vite: npm i -D vite @vitejs/plugin-vue
├── [ ] 创建 vite.config.js
├── [ ] 创建 index.html (Vite 入口是 HTML，不是 JS)
├── [ ] 修改 package.json scripts
│   ├── "dev": "vite"
│   ├── "build": "vite build"
│   └── "preview": "vite preview"
└── [ ] 环境变量: .env → .env (Vite 用 VITE_ 前缀)

Phase 2: 配置迁移
├── [ ] resolve.alias → resolve.alias
├── [ ] devServer → server
├── [ ] output → build.outDir + build.rollupOptions.output
├── [ ] DefinePlugin → define
├── [ ] CSS loaders → css.preprocessorOptions
├── [ ] 图片/字体 → 内置 (无需配置)
└── [ ] HTML 模板 → index.html (Vite 原生支持)

Phase 3: 插件替换
├── [ ] vue-loader → @vitejs/plugin-vue
├── [ ] babel-loader → 内置 esbuild (或 @vitejs/plugin-vue-jsx)
├── [ ] style-loader/css-loader → 内置
├── [ ] url-loader/file-loader → 内置 (import 自动处理)
├── [ ] html-webpack-plugin → index.html 入口
├── [ ] copy-webpack-plugin → publicDir
├── [ ] terser → build.minify: 'esbuild' (或 terser 插件)
└── [ ] 自定义插件 → 找 Vite 等价物或手写

Phase 4: 代码适配
├── [ ] process.env → import.meta.env (VITE_ 前缀)
├── [ ] __dirname/__filename → import.meta.url (ESM)
├── [ ] require.context → import.meta.glob
├── [ ] require.ensure → import()
├── [ ] module.hot → import.meta.hot
└── [ ] CommonJS → ESM (Vite 生产构建要求 ESM)

Phase 5: 验证
├── [ ] 开发服务器启动 < 1s
├── [ ] HMR 延迟 < 50ms
├── [ ] 生产构建产物正确
├── [ ] Source Map 正确
├── [ ] 所有路由可访问
├── [ ] 静态资源路径正确
├── [ ] 环境变量注入正确
└── [ ] 回归测试通过
```

### 2.5 常见迁移陷阱

```
Webpack → Vite 迁移陷阱:

陷阱 1: require.context 不可用
  ❌ Webpack: const modules = require.context('./modules', true, /\.js$/);
  ✅ Vite:   const modules = import.meta.glob('./modules/**/*.js');

陷阱 2: CommonJS 在 ESM 中行为不同
  ❌ Webpack: const config = require('./config.json'); // 直接返回对象
  ✅ Vite:   import config from './config.json' assert { type: 'json' };
  或: 用插件处理 JSON import

陷阱 3: 动态路径 require
  ❌ Webpack: const mod = require(`./lang/${locale}.js`);
  ✅ Vite:   const modules = import.meta.glob('./lang/*.js');
             const mod = await modules[`./lang/${locale}.js`]();

陷阱 4: Node.js 内置模块
  ❌ Webpack: 自动 polyfill (buffer, process, path 等)
  ✅ Vite:   不 polyfill，需要手动配置
             optimizeDeps: { include: ['buffer', 'process'] }

陷阱 5: 非标准文件类型
  ❌ Webpack: 通过 loader 处理任意文件类型
  ✅ Vite:   需要写插件处理非标准文件类型

陷阱 6: 插件顺序
  ❌ Webpack: Loader 按数组顺序执行 (从右到左)
  ✅ Vite:   插件按 enforce 排序 (pre → normal → post)

陷阱 7: 环境变量
  ❌ Webpack: process.env.VUE_APP_XXX
  ✅ Vite:   import.meta.env.VITE_XXX (只有 VITE_ 前缀暴露)

陷阱 8: publicPath
  ❌ Webpack: output.publicPath = '/app/'
  ✅ Vite:   base: '/app/'
```

---

## 三、Bundle 可视化分析 — 从数据到决策

### 3.1 分析工具矩阵

```
Bundle 分析工具全景:

┌──────────────────────────────────────────────────────────────┐
│ 工具              │ 格式        │ 可视化    │ 核心能力        │
├──────────────────────────────────────────────────────────────┤
│ rollup-plugin-visualizer│ treemap/sunburst │ HTML 报告 │ 依赖关系 │
│ webpack-bundle-analyzer │ treemap          │ Web 界面  │ 模块大小 │
│ source-map-explorer     │ treemap          │ CLI/HTML  │ SourceMap│
│ bundlephobia.com        │ 在线             │ 网站      │ 包体积   │
│ import-cost             │ 编辑器内联       │ VSCode    │ 实时     │
│ size-limit              │ CLI              │ CI 集成   │ 预算     │
│ bundlesize              │ CLI              │ CI 集成   │ 预算     │
│ chromatic               │ 视觉回归         │ 网站      │ UI diff  │
└──────────────────────────────────────────────────────────────┘
```

### 3.2 手写 Bundle 分析器

```javascript
// bundle-analyzer.js — 从零实现 Bundle 分析器

const fs = require('fs');
const path = require('path');

class BundleAnalyzer {
  constructor(bundlePath) {
    this.bundlePath = bundlePath;
    this.bundle = fs.readFileSync(bundlePath, 'utf-8');
    this.modules = [];
    this.stats = {};
  }

  // ========== 1. 模块提取 ==========
  extractModules() {
    // 解析 webpack/vite bundle 中的模块
    const moduleRegex = /\/\*\*\* (.+?) \*{3,} \*\/([\s\S]*?)(?=\/\*\*\* .* \*{3,} \*\/|$)/g;
    let match;

    while ((match = moduleRegex.exec(this.bundle)) !== null) {
      const moduleId = match[1];
      const moduleCode = match[2];
      this.modules.push({
        id: moduleId,
        code: moduleCode,
        size: Buffer.byteLength(moduleCode, 'utf-8'),
        gzipSize: null, // 稍后计算
      });
    }

    // 如果没有匹配到模块标记，按文件大小估算
    if (this.modules.length === 0) {
      this.modules.push({
        id: path.basename(this.bundlePath),
        code: this.bundle,
        size: Buffer.byteLength(this.bundle, 'utf-8'),
        gzipSize: null,
      });
    }

    return this.modules;
  }

  // ========== 2. 依赖提取 ==========
  extractDependencies() {
    const deps = new Set();

    for (const mod of this.modules) {
      // ESM import
      const esmMatches = mod.code.matchAll(/from\s+['"]([^'"]+)['"]/g);
      for (const m of esmMatches) {
        if (!m[1].startsWith('.') && !m[1].startsWith('/')) {
          deps.add(m[1]);
        }
      }
      // CJS require
      const cjsMatches = mod.code.matchAll(/require\s*\(\s*['"]([^'"]+)['"]\s*\)/g);
      for (const m of cjsMatches) {
        if (!m[1].startsWith('.') && !m[1].startsWith('/')) {
          deps.add(m[1]);
        }
      }
    }

    return [...deps];
  }

  // ========== 3. Gzip 大小估算 ==========
  calculateGzipSizes() {
    const zlib = require('zlib');

    for (const mod of this.modules) {
      mod.gzipSize = zlib.gzipSync(mod.code).length;
    }
  }

  // ========== 4. 统计分析 ==========
  analyze() {
    this.extractModules();
    this.calculateGzipSizes();

    const totalSize = this.modules.reduce((sum, m) => sum + m.size, 0);
    const totalGzip = this.modules.reduce((sum, m) => sum + m.gzipSize, 0);

    // 按大小排序
    const sorted = [...this.modules].sort((a, b) => b.size - a.size);

    // Top 10 最大模块
    const top10 = sorted.slice(0, 10);

    // 第三方依赖占比
    const vendorModules = this.modules.filter(m =>
      m.id.includes('node_modules')
    );
    const vendorSize = vendorModules.reduce((sum, m) => sum + m.size, 0);

    // 代码类型分布
    const typeDist = {};
    for (const mod of this.modules) {
      const ext = path.extname(mod.id) || '.unknown';
      typeDist[ext] = (typeDist[ext] || 0) + mod.size;
    }

    this.stats = {
      totalModules: this.modules.length,
      totalSize,
      totalGzip,
      compressionRatio: ((1 - totalGzip / totalSize) * 100).toFixed(1),
      vendorModules: vendorModules.length,
      vendorSize,
      vendorPercent: ((vendorSize / totalSize) * 100).toFixed(1),
      top10: top10.map(m => ({
        id: m.id,
        size: m.size,
        gzipSize: m.gzipSize,
        percent: ((m.size / totalSize) * 100).toFixed(1),
      })),
      typeDistribution: typeDist,
      dependencies: this.extractDependencies(),
    };

    return this.stats;
  }

  // ========== 5. 生成报告 ==========
  generateReport() {
    const s = this.stats;

    let report = `
╔══════════════════════════════════════════════════════════╗
║              📦 Bundle Analysis Report                  ║
╠══════════════════════════════════════════════════════════╣
║                                                          ║
║  文件: ${path.basename(this.bundlePath)}                    ║
║  模块数: ${s.totalModules}                                  ║
║  总大小: ${(s.totalSize / 1024).toFixed(2)} KB (原始)       ║
║  Gzip:   ${(s.totalGzip / 1024).toFixed(2)} KB              ║
║  压缩率: ${s.compressionRatio}%                              ║
║                                                          ║
║  ── 第三方依赖 ──                                         ║
║  模块数: ${s.vendorModules} (${s.vendorPercent}%)          ║
║  大小:   ${(s.vendorSize / 1024).toFixed(2)} KB            ║
║                                                          ║
║  ── Top 10 最大模块 ──                                    ║
`;

    for (let i = 0; i < s.top10.length; i++) {
      const m = s.top10[i];
      const bar = '█'.repeat(Math.round(m.percent / 2));
      report += `║  ${i + 1}. ${(m.id.slice(0, 40)).padEnd(42)}║\n`;
      report += `     ${bar} ${(m.size / 1024).toFixed(1)}KB (${m.percent}%)                    ║\n`;
    }

    report += `║                                                          ║\n`;
    report += `║  ── 代码类型分布 ──                                       ║\n`;

    for (const [ext, size] of Object.entries(s.typeDistribution).sort((a, b) => b[1] - a[1])) {
      const pct = ((size / s.totalSize) * 100).toFixed(1);
      report += `║  ${ext.padEnd(8)} ${(size / 1024).toFixed(2).padStart(8)}KB  ${pct.padStart(5)}%            ║\n`;
    }

    report += `║                                                          ║\n`;
    report += `║  ── 第三方依赖列表 ──                                     ║\n`;

    for (const dep of s.dependencies.slice(0, 20)) {
      report += `║  • ${dep.padEnd(58)}║\n`;
    }

    report += `╚══════════════════════════════════════════════════════════╝`;

    return report;
  }

  // ========== 6. 优化建议 ==========
  generateSuggestions() {
    const suggestions = [];
    const s = this.stats;

    // 建议 1: 第三方依赖占比过高
    if (parseFloat(s.vendorPercent) > 70) {
      suggestions.push({
        severity: 'warning',
        title: '第三方依赖占比过高',
        detail: `第三方依赖占 ${(s.vendorPercent)}%，考虑使用 CDN 或 external`,
        action: '将大型库 (React/Vue/Lodash) 改为 CDN 引入',
      });
    }

    // 建议 2: 单个模块过大
    const largeModules = s.top10.filter(m => m.size > 100 * 1024);
    if (largeModules.length > 0) {
      suggestions.push({
        severity: 'error',
        title: '存在超大模块',
        detail: `${largeModules.length} 个模块超过 100KB`,
        action: '使用代码分割 (dynamic import) 拆分',
      });
    }

    // 建议 3: 重复依赖
    const deps = s.dependencies;
    const uniqueDeps = new Set(deps.map(d => d.split('/')[0]));
    if (deps.length > uniqueDeps.size * 1.5) {
      suggestions.push({
        severity: 'info',
        title: '可能存在重复依赖',
        detail: `导入语句 ${deps.length} 个，唯一包 ${uniqueDeps.size} 个`,
        action: '使用 npm ls 检查重复依赖，考虑 dedupe',
      });
    }

    // 建议 4: Gzip 压缩率
    if (parseFloat(s.compressionRatio) < 60) {
      suggestions.push({
        severity: 'warning',
        title: 'Gzip 压缩率偏低',
        detail: `压缩率仅 ${s.compressionRatio}%，可能存在已压缩资源`,
        action: '检查是否混入了已压缩文件 (min.js 等)',
      });
    }

    // 建议 5: Source Map
    if (this.bundle.includes('sourceMappingURL')) {
      suggestions.push({
        severity: 'info',
        title: '检测到 Source Map',
        detail: '生产环境不应包含 Source Map',
        action: '设置 build.sourcemap: false 或 hidden',
      });
    }

    return suggestions;
  }
}

// ========== 使用示例 ==========

// const analyzer = new BundleAnalyzer('./dist/bundle.js');
// analyzer.analyze();
// console.log(analyzer.generateReport());
// console.log('\n' + analyzer.generateSuggestions().map(s =>
//   `[${s.severity}] ${s.title}: ${s.action}`
// ).join('\n'));

console.log('✅ BundleAnalyzer 实现完成');
console.log('   - 模块提取: 解析 bundle 中的模块边界');
console.log('   - 依赖提取: ESM + CJS 依赖扫描');
console.log('   - Gzip 估算: zlib.gzipSync 精确计算');
console.log('   - 统计分析: Top10/类型分布/第三方占比');
console.log('   - 优化建议: 自动检测常见问题');
```

### 3.3 Bundle 优化策略决策树

```
Bundle 体积优化决策树:

                    ┌─────────────────┐
                    │ Bundle 过大？    │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │ 第三方依赖占比？ │
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              │ > 60%        │ 30-60%       │ < 30%
              ▼              ▼              ▼
      ┌───────────────┐ ┌─────────────┐ ┌──────────────┐
      │ External + CDN│ │ Tree Shaking│ │ 代码分割     │
      │ 或 Monorepo   │ │ 优化业务代码│ │ + 懒加载     │
      └───────┬───────┘ └──────┬──────┘ └──────┬───────┘
              │                │                │
              ▼                ▼                ▼
      检查:              检查:              检查:
      • lodash → lodash-es • 未使用导出      • 路由懒加载
      • moment → date-fns  • 死代码         • 组件懒加载
      • antd → 按需加载    • 未使用依赖      • 预加载策略
                             • 重复打包
```

---

## 四、CSS 管线架构 — 从源码到产物的完整链路

### 4.1 CSS 处理管线全景

```
现代 CSS 管线架构:

┌─────────────────────────────────────────────────────────────┐
│                    CSS 处理管线                              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  输入层:                                                      │
│  ├── SCSS/Sass → 变量/嵌套/混合/继承                         │
│  ├── Less → 变量/混合/运算                                   │
│  ├── Stylus → 简洁语法/函数                                  │
│  ├── PostCSS → 插件管道 (Autoprefixer/CSSNext)               │
│  └── Tailwind → 原子化 CSS 框架                              │
│                                                              │
│  处理层:                                                      │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ 1. 预处理 (Sass/Less) → 编译为 CSS                      │  │
│  │ 2. PostCSS 插件链:                                      │  │
│  │    ├── postcss-import (内联 @import)                    │  │
│  │    ├── postcss-mixins (混合宏)                          │  │
│  │    ├── postcss-nested (嵌套语法)                        │  │
│  │    ├── autoprefixer (浏览器前缀)                        │  │
│  │    ├── postcss-preset-env (CSS Next 特性)              │  │
│  │    ├── cssnano (压缩优化)                               │  │
│  │    └── postcss-pxtorem (px → rem 转换)                 │  │
│  │ 3. CSS Modules → 局部作用域                              │  │
│  │ 4. 内联/提取 → style-loader / MiniCssExtractPlugin      │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  输出层:                                                      │
│  ├── 内联 CSS (开发模式) → <style> 标签                      │
│  ├── 提取 CSS (生产模式) → .css 文件                         │
│  ├── Source Map → 调试支持                                   │
│  └── Critical CSS → 首屏关键样式内联                         │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 手写 CSS 管线处理器

```javascript
// css-pipeline.js — 从零实现 CSS 处理管线

const crypto = require('crypto');

class CSSPipeline {
  constructor(options = {}) {
    this.plugins = [];
    this.options = {
      sourceMap: options.sourceMap || false,
      modules: options.modules || false,
      minimize: options.minimize || false,
      ...options,
    };
  }

  // ========== 注册插件 ==========
  use(plugin) {
    this.plugins.push(plugin);
    return this; // 链式调用
  }

  // ========== 处理 CSS ==========
  async process(source, filename = 'input.css') {
    let result = source;
    const map = { version: 3, sources: [filename], names: [], mappings: '' };

    // 1. 预处理: @import 内联
    result = this.inlineImports(result, filename);

    // 2. 预处理: 变量替换
    result = this.processVariables(result);

    // 3. 预处理: 嵌套展开
    result = this.flattenNesting(result);

    // 4. PostCSS 插件链
    for (const plugin of this.plugins) {
      result = await plugin(result, { filename, options: this.options });
    }

    // 5. CSS Modules: 类名哈希
    if (this.options.modules) {
      result = this.processModules(result, filename);
    }

    // 6. 压缩
    if (this.options.minimize) {
      result = this.minimize(result);
    }

    return {
      css: result,
      map: JSON.stringify(map),
      dependencies: this.extractDependencies(source),
    };
  }

  // ========== @import 内联 ==========
  inlineImports(css, filename) {
    const importRegex = /@import\s+['"]([^'"]+)['"]\s*;/g;
    const fs = require('fs');
    const path = require('path');

    return css.replace(importRegex, (match, importPath) => {
      // 解析路径
      let resolved = importPath;
      if (importPath.startsWith('.')) {
        resolved = path.resolve(path.dirname(filename), importPath);
        // 尝试 .css 扩展名
        if (!resolved.endsWith('.css') && !fs.existsSync(resolved)) {
          resolved += '.css';
        }
      }

      try {
        const imported = fs.readFileSync(resolved, 'utf-8');
        return `/* @import: ${importPath} */\n${imported}`;
      } catch {
        return match; // 保持原样
      }
    });
  }

  // ========== 变量处理 ==========
  processVariables(css) {
    // 提取 :root 变量
    const rootMatch = css.match(/:root\s*\{([^}]+)\}/);
    const variables = {};

    if (rootMatch) {
      const varRegex = /--([\w-]+)\s*:\s*([^;]+);/g;
      let m;
      while ((m = varRegex.exec(rootMatch[1])) !== null) {
        variables[m[1]] = m[2].trim();
      }
    }

    // 替换 var() 引用
    let result = css;
    for (const [name, value] of Object.entries(variables)) {
      const regex = new RegExp(`var\\(--${name}\\)`, 'g');
      result = result.replace(regex, value);
    }

    // 移除 :root (已内联)
    result = result.replace(/:root\s*\{[^}]+\}\s*/g, '');

    return result;
  }

  // ========== 嵌套展开 ==========
  flattenNesting(css) {
    // 简化: 处理一层嵌套
    const nestedRegex = /([^{}]+)\s*\{([^{}]*\{[^{}]*\}[^{}]*)\}/g;
    let result = css;
    let prev;

    // 迭代展开直到没有嵌套
    do {
      prev = result;
      result = result.replace(nestedRegex, (match, parent, body) => {
        // 展开嵌套选择器
        const nestedRegex2 = /([^{}]+)\s*\{([^{}]*)\}/g;
        let expanded = '';
        let m;
        while ((m = nestedRegex2.exec(body)) !== null) {
          const selector = m[1].trim();
          const rules = m[2].trim();
          const combined = selector.startsWith('&')
            ? parent.trim() + selector.slice(1)
            : parent.trim() + ' ' + selector;
          expanded += `${combined} { ${rules} }\n`;
        }
        return expanded;
      });
    } while (result !== prev);

    return result;
  }

  // ========== CSS Modules ==========
  processModules(css, filename) {
    const classHash = {};
    const hash = crypto.createHash('md5').update(filename).digest('hex').slice(0, 8);

    // 匹配类名
    const classRegex = /\.([\w-]+)/g;
    let m;
    while ((m = classRegex.exec(css)) !== null) {
      const className = m[1];
      if (!classHash[className]) {
        classHash[className] = `${className}_${hash}`;
      }
    }

    // 替换类名
    let result = css;
    for (const [original, hashed] of Object.entries(classHash)) {
      const regex = new RegExp(`\\.${original}\\b`, 'g');
      result = result.replace(regex, `.${hashed}`);
    }

    return result;
  }

  // ========== 压缩 ==========
  minimize(css) {
    return css
      // 移除注释
      .replace(/\/\*[\s\S]*?\*\//g, '')
      // 移除多余空格
      .replace(/\s+/g, ' ')
      // 移除选择器后空格
      .replace(/\s*\{\s*/g, '{')
      // 移除属性后空格
      .replace(/\s*\}\s*/g, '}')
      // 移除分号后空格
      .replace(/\s*;\s*/g, ';')
      // 移除冒号后空格
      .replace(/\s*:\s*/g, ':')
      // 移除逗号后空格
      .replace(/\s*,\s*/g, ',')
      // 移除最后分号
      .replace(/;}/g, '}')
      .trim();
  }

  // ========== 依赖提取 ==========
  extractDependencies(css) {
    const deps = [];
    const importRegex = /@import\s+['"]([^'"]+)['"]/g;
    let m;
    while ((m = importRegex.exec(css)) !== null) {
      deps.push(m[1]);
    }
    return deps;
  }
}

// ========== 内置插件 ==========

// 插件: Autoprefixer (简化版)
function autoprefixer(targets = ['> 1%', 'last 2 versions']) {
  return async (css) => {
    // 简化: 只处理 transform
    const transforms = [
      { prop: 'transform', prefixes: ['-webkit-', '-ms-'] },
      { prop: 'transition', prefixes: ['-webkit-', '-moz-', '-o-'] },
      { prop: 'animation', prefixes: ['-webkit-'] },
      { prop: 'flex', prefixes: ['-webkit-', '-ms-'] },
      { prop: 'grid', prefixes: ['-ms-'] },
    ];

    let result = css;
    for (const { prop, prefixes } of transforms) {
      const regex = new RegExp(`(${prop}\\s*:)`, 'g');
      result = result.replace(regex, (match) => {
        const prefixed = prefixes
          .map(p => match.replace(prop, p + prop))
          .join('\n  ');
        return match + '\n  ' + prefixed;
      });
    }
    return result;
  };
}

// 插件: CSS Next (简化版)
function cssNext() {
  return async (css) => {
    let result = css;

    // color-mix() → 降级
    const colorMixRegex = /color-mix\s*\(\s*in\s+(\w+)\s*,\s*([^,]+)\s+(\d+)%\s*,\s*([^)]+)\s*\)/g;
    result = result.replace(colorMixRegex, (match, space, c1, pct, c2) => {
      return `/* color-mix fallback */ ${c1}`; // 简化降级
    });

    // :has() → 降级
    const hasRegex = /:has\(([^)]+)\)/g;
    result = result.replace(hasRegex, '/* :has() not supported */');

    return result;
  };
}

// 插件: px2rem
function px2rem(rootValue = 75) {
  return async (css) => {
    return css.replace(/(\d+\.?\d*)px/g, (match, value) => {
      const rem = (parseFloat(value) / rootValue).toFixed(4);
      return rem.endsWith('0') ? rem.replace(/0+$/, '') || '0' : rem;
    });
  };
}

// ========== 使用示例 ==========

const pipeline = new CSSPipeline({
  sourceMap: true,
  modules: true,
  minimize: true,
});

pipeline
  .use(autoprefixer(['> 1%', 'last 2 versions']))
  .use(cssNext())
  .use(px2rem(75));

// const result = await pipeline.process(sourceCSS, 'styles.scss');
// console.log(result.css);

console.log('✅ CSSPipeline 实现完成');
console.log('   - 管线架构: 插件链式处理 (PostCSS 风格)');
console.log('   - 预处理: @import 内联 + 变量替换 + 嵌套展开');
console.log('   - 内置插件: Autoprefixer, CSS Next, px2rem');
console.log('   - CSS Modules: 类名哈希 + 局部作用域');
console.log('   - 压缩: 移除空格/注释/冗余分隔符');
```

### 4.3 CSS 性能优化策略

```
CSS 性能优化 Checklist:

┌─────────────────────────────────────────────────────────────┐
│ 1. Critical CSS 内联                                       │
│    ├── 提取首屏关键样式                                      │
│    ├── 内联到 <head> <style> 标签                           │
│    └── 异步加载剩余 CSS                                     │
│                                                             │
│ 2. CSS 代码分割                                            │
│    ├── 路由级 CSS 分割 (每个路由独立 CSS)                    │
│    ├── 组件级 CSS 分割 (Vue SFC / CSS Modules)              │
│    └── 按需加载 (IntersectionObserver 触发)                 │
│                                                             │
│ 3. 减少 CSS 体积                                           │
│    ├── 移除未使用 CSS (PurgeCSS / uncss)                    │
│    ├── 使用原子化 CSS (Tailwind 按需生成)                   │
│    ├── 避免重复样式 (CSS 变量 + 混合)                       │
│    └── 字体子集化 (font-subset)                             │
│                                                             │
│ 4. 减少 CSS 请求                                           │
│    ├── 合并 CSS 文件 (生产环境)                             │
│    ├── 内联小 CSS (< 1KB)                                   │
│    └── HTTP/2 多路复用 (不需要合并)                         │
│                                                             │
│ 5. 渲染优化                                                │
│    ├── 避免 @import (阻塞渲染)                              │
│    ├── 使用 <link rel=preload> 预加载关键 CSS               │
│    ├── 避免 CSS 表达式 (IE)                                │
│    └── 使用 will-change 提示浏览器优化                      │
│                                                             │
│ 6. 缓存策略                                                │
│    ├── 文件名哈希 (contenthash)                             │
│    ├── Cache-Control: max-age=31536000, immutable          │
│    └── Service Worker 缓存                                 │
└─────────────────────────────────────────────────────────────┘
```

---

## 五、CI/CD 构建流水线 — 从代码提交到产物部署

### 5.1 构建流水线架构

```
现代前端 CI/CD 构建流水线:

┌─────────────────────────────────────────────────────────────┐
│                  CI/CD 构建流水线                            │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐              │
│  │  代码提交  │ → │  Lint    │ → │  单元测试  │              │
│  │ (git push) │   │ & Type   │   │ (Jest/   │              │
│  └──────────┘    │  Check   │   │  Vitest)  │              │
│                  │ (ESLint  │   └──────────┘              │
│                  │  + TSC) │                                │
│                  └──────────┘    ┌──────────┐              │
│                                  │  构建    │              │
│                  ┌──────────┐    │ (Vite/   │              │
│                  │  E2E 测试 │ ← │  Webpack)│              │
│                  │ (Playwright│  └──────────┘              │
│                  │  / Cypress)│       │                    │
│                  └──────────┘    ┌──────▼──────┐           │
│                                  │  Bundle     │           │
│                  ┌──────────┐    │  Analysis   │           │
│                  │  部署     │ ← │  (体积检查) │           │
│                  │ (CDN/    │    └─────────────┘           │
│                  │  Server) │                                │
│                  └──────────┘                                │
│                                                              │
│  质量门禁:                                                    │
│  ├── Lint 错误 = 0                                           │
│  ├── TypeScript 编译通过                                      │
│  ├── 单元测试覆盖率 > 80%                                    │
│  ├── Bundle 体积 < 阈值                                      │
│  ├── E2E 测试通过                                            │
│  └── 安全扫描无高危漏洞                                       │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 5.2 GitHub Actions 构建流水线

```yaml
# .github/workflows/build.yml — 完整前端 CI/CD 流水线

name: Frontend CI/CD

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

env:
  NODE_VERSION: '20'
  CI: true

jobs:
  # ========== Job 1: 质量检查 ==========
  quality:
    name: Quality Check
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: ESLint
        run: npm run lint

      - name: TypeScript Check
        run: npx tsc --noEmit

      - name: Format Check
        run: npm run format:check

  # ========== Job 2: 单元测试 ==========
  test:
    name: Unit Tests
    runs-on: ubuntu-latest
    needs: quality
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run tests
        run: npm run test:coverage

      - name: Upload coverage
        uses: codecov/codecov-action@v4
        with:
          file: ./coverage/lcov.info

  # ========== Job 3: 构建 ==========
  build:
    name: Build
    runs-on: ubuntu-latest
    needs: [quality, test]
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build
        run: npm run build
        env:
          VITE_API_URL: ${{ secrets.API_URL }}

      - name: Bundle Analysis
        run: |
          npm install -D rollup-plugin-visualizer
          npx vite build --mode analysis

      - name: Size Check
        run: |
          # 检查 bundle 体积
          MAX_SIZE=500000  # 500KB
          ACTUAL_SIZE=$(du -sb dist/assets | awk '{print $1}')
          if [ $ACTUAL_SIZE -gt $MAX_SIZE ]; then
            echo "❌ Bundle too large: ${ACTUAL_SIZE}B > ${MAX_SIZE}B"
            exit 1
          fi
          echo "✅ Bundle size OK: ${ACTUAL_SIZE}B"

      - name: Upload artifacts
        uses: actions/upload-artifact@v4
        with:
          name: dist
          path: dist/
          retention-days: 7

  # ========== Job 4: E2E 测试 ==========
  e2e:
    name: E2E Tests
    runs-on: ubuntu-latest
    needs: build
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Download build artifacts
        uses: actions/download-artifact@v4
        with:
          name: dist
          path: dist/

      - name: Install Playwright
        run: npx playwright install --with-deps

      - name: Run E2E tests
        run: npm run test:e2e

      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: playwright-report/

  # ========== Job 5: 部署 ==========
  deploy:
    name: Deploy
    runs-on: ubuntu-latest
    needs: [build, e2e]
    if: github.ref == 'refs/heads/main'
    steps:
      - name: Download build artifacts
        uses: actions/download-artifact@v4
        with:
          name: dist
          path: dist/

      - name: Deploy to CDN
        uses: jakejarvis/s3-sync-action@master
        with:
          args: --delete --cache-control "max-age=31536000, immutable"
        env:
          AWS_S3_BUCKET: ${{ secrets.CDN_BUCKET }}
          AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY }}
          AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_KEY }}
          SOURCE_DIR: dist/

      - name: Invalidate CDN cache
        run: |
          aws cloudfront create-invalidation \
            --distribution-id ${{ secrets.CF_DISTRIBUTION_ID }} \
            --paths "/*"
```

### 5.3 构建缓存策略

```
CI/CD 构建缓存策略:

┌─────────────────────────────────────────────────────────────┐
│ 缓存层级:                                                    │
│                                                              │
│  L1: 依赖缓存 (node_modules)                                 │
│  ├── 工具: actions/cache / pnpm store                        │
│  ├── 命中率: > 95% (lockfile 不变)                          │
│  ├── 节省时间: 30-60s                                        │
│  └── 失效条件: package.json 或 lockfile 变更                  │
│                                                              │
│  L2: 构建缓存 (编译产物)                                     │
│  ├── 工具: Turborepo / Nx Cache                              │
│  ├── 命中率: 80-90% (未变更模块)                             │
│  ├── 节省时间: 10-30s                                        │
│  └── 失效条件: 源文件变更                                    │
│                                                              │
│  L3: 测试缓存 (测试结果)                                     │
│  ├── 工具: Jest --cache / Vitest cache                       │
│  ├── 命中率: 70-80% (未变更文件)                             │
│  ├── 节省时间: 5-15s                                         │
│  └── 失效条件: 测试文件或依赖变更                             │
│                                                              │
│  L4: Docker 层缓存                                           │
│  ├── 工具: BuildKit 缓存                                     │
│  ├── 命中率: 90%+ (未变更层)                                 │
│  ├── 节省时间: 20-40s                                        │
│  └── 失效条件: Dockerfile 变更                               │
│                                                              │
│  缓存配置最佳实践:                                            │
│  ├── 使用 contenthash 作为缓存 key                           │
│  ├── 多平台缓存 (Linux/macOS/Windows 分开)                   │
│  ├── 缓存压缩 (gzip/zstd)                                   │
│  ├── 缓存过期 (7 天自动清理)                                 │
│  └── 缓存大小限制 (5GB/仓库)                                 │
└─────────────────────────────────────────────────────────────┘
```

### 5.4 构建性能优化 Checklist

```
CI/CD 构建性能优化 Checklist:

┌─────────────────────────────────────────────────────────────┐
│ 1. 并行化                                                   │
│    ├── Lint + Test + Build 并行执行                         │
│    ├── 多浏览器 E2E 并行 (Playwright shards)                │
│    └── 多包 Monorepo 并行构建 (Turborepo)                   │
│                                                             │
│ 2. 增量构建                                                 │
│    ├── 使用 Turborepo/Nx 增量管道                           │
│    ├── 远程缓存 (Vercel/Turborepo Remote Cache)             │
│    └── 按需构建 (只构建变更包)                               │
│                                                             │
│ 3. 依赖安装优化                                             │
│    ├── npm ci (比 npm install 快 30%)                      │
│    ├── pnpm (比 npm 快 2x，磁盘节省 60%)                   │
│    ├── 缓存 node_modules (actions/cache)                    │
│    └── 使用 --frozen-lockfile (确保可重现)                   │
│                                                             │
│ 4. 构建工具优化                                             │
│    ├── Webpack → Rspack (5-10x 加速)                       │
│    ├── Babel → esbuild (20x 加速)                          │
│    ├── Terser → esbuild minify (40x 加速)                  │
│    └── Sass → embedded-sass (3x 加速)                      │
│                                                             │
│ 5. 测试优化                                                 │
│    ├── 测试分片 (sharding)                                  │
│    ├── 只运行变更文件相关测试 (Jest --changedSince)          │
│    ├── 并行测试 (Jest --maxWorkers)                         │
│    └── 缓存测试结果                                         │
│                                                             │
│ 6. 部署优化                                                 │
│    ├── 增量部署 (只上传变更文件)                             │
│    ├── CDN 预热 (预拉取热门资源)                             │
│    └── 蓝绿部署 (零停机)                                    │
└─────────────────────────────────────────────────────────────┘
```

---

## 六、实战项目：手写完整构建系统

### 6.1 项目结构

```
mini-build-system/
├── src/
│   ├── core/
│   │   ├── compiler.js      — 编译器核心
│   │   ├── plugin-system.js — 插件系统
│   │   └── module-graph.js  — 模块依赖图
│   ├── plugins/
│   │   ├── alias.js         — 路径别名
│   │   ├── css.js           — CSS 处理
│   │   ├── env.js           — 环境变量
│   │   ├── html.js          — HTML 模板
│   │   ├── analyze.js       — Bundle 分析
│   │   └── copy.js          — 静态资源复制
│   ├── loaders/
│   │   ├── js-loader.js     — JS/TS 转换
│   │   └── vue-loader.js    — Vue SFC 处理
│   ├── utils/
│   │   ├── fs.js            — 文件系统工具
│   │   ├── hash.js          — 内容哈希
│   │   └── logger.js        — 日志工具
│   └── index.js             — 入口
├── package.json
├── mini.config.js             — 配置文件
└── README.md
```

### 6.2 核心编译器

```javascript
// mini-build-system/src/core/compiler.js

const path = require('path');
const fs = require('fs').promises;
const { ModuleGraph } = require('./module-graph');
const { createPluginSystem } = require('./plugin-system');
const { logger } = require('../utils/logger');
const { computeHash } = require('../utils/hash');

class Compiler {
  constructor(config) {
    this.config = config;
    this.context = config.context || process.cwd();
    this.moduleGraph = new ModuleGraph();
    this.plugins = createPluginSystem();
    this.assets = new Map();
    this.startTime = null;
  }

  // 注册插件
  use(plugin) {
    this.plugins.use(plugin);
    return this;
  }

  // 主编译流程
  async compile() {
    this.startTime = Date.now();
    logger.info('🚀 Starting build...');

    try {
      // 1. 初始化
      await this.plugins.hooks.beforeCompile.call(this);
      logger.step('1/6', 'Initializing...');

      // 2. 解析入口
      const entry = this.config.entry || './src/index.js';
      const entryId = await this.resolveModule(entry);
      logger.step('2/6', `Entry: ${entryId}`);

      // 3. 构建模块图
      await this.buildModuleGraph(entryId);
      logger.step('3/6', `Modules: ${this.moduleGraph.size}`);

      // 4. 转换模块
      await this.transformModules();
      logger.step('4/6', 'Transforming...');

      // 5. 生成产物
      await this.generateAssets();
      logger.step('5/6', `Assets: ${this.assets.size}`);

      // 6. 输出产物
      await this.emitAssets();
      logger.step('6/6', 'Emitting...');

      // 完成
      const duration = Date.now() - this.startTime;
      await this.plugins.hooks.afterCompile.call({
        duration,
        modules: this.moduleGraph.size,
        assets: this.assets.size,
      });

      logger.success(`✅ Build complete in ${duration}ms`);
      return { duration, modules: this.moduleGraph.size, assets: this.assets.size };
    } catch (error) {
      logger.error(`❌ Build failed: ${error.message}`);
      await this.plugins.hooks.onError.call(error);
      throw error;
    }
  }

  // 解析模块
  async resolveModule(source, importer = null) {
    // 插件钩子
    const pluginResult = await this.plugins.hooks.resolveId.call(source, importer);
    if (pluginResult) return pluginResult;

    // 别名处理
    const aliases = this.config.resolve?.alias || {};
    for (const [key, value] of Object.entries(aliases)) {
      if (source === key || source.startsWith(key + '/')) {
        source = source.replace(key, value);
        break;
      }
    }

    // 路径解析
    if (source.startsWith('.') || source.startsWith('/')) {
      const baseDir = importer ? path.dirname(importer) : this.context;
      let resolved = path.resolve(baseDir, source);

      // 尝试扩展名
      const extensions = this.config.resolve?.extensions || ['.js', '.ts', '.jsx', '.tsx', '.vue', '.json'];
      for (const ext of extensions) {
        try {
          await fs.access(resolved + ext);
          return resolved + ext;
        } catch {}
      }

      // 尝试 index
      try {
        await fs.access(path.join(resolved, 'index.js'));
        return path.join(resolved, 'index.js');
      } catch {}

      return resolved;
    }

    // node_modules (简化)
    return source;
  }

  // 构建模块图
  async buildModuleGraph(entryId) {
    const queue = [entryId];
    const visited = new Set();

    while (queue.length > 0) {
      const currentId = queue.shift();
      if (visited.has(currentId)) continue;
      visited.add(currentId);

      // 跳过 node_modules
      if (currentId.includes('node_modules')) {
        this.moduleGraph.addNode(currentId, {
          id: currentId,
          source: `/* external: ${currentId} */`,
          transformed: `module.exports = require('${currentId}');`,
          dependencies: [],
          isExternal: true,
        });
        continue;
      }

      // 读取源文件
      const source = await fs.readFile(currentId, 'utf-8');

      // 插件: load
      const loaded = await this.plugins.hooks.load.call(currentId, source);
      const content = loaded || source;

      // 提取依赖
      const deps = this.extractDependencies(content);

      this.moduleGraph.addNode(currentId, {
        id: currentId,
        source: content,
        transformed: null,
        dependencies: deps,
        isExternal: false,
      });

      // 递归解析依赖
      for (const dep of deps) {
        const resolved = await this.resolveModule(dep, currentId);
        if (resolved && !visited.has(resolved)) {
          queue.push(resolved);
          this.moduleGraph.addEdge(currentId, resolved);
        }
      }
    }
  }

  // 提取依赖
  extractDependencies(code) {
    const deps = [];
    const patterns = [
      /import\s+(?:[\s\S]*?\s+from\s+)?['"]([^'"]+)['"]/g,
      /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
      /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    ];

    for (const regex of patterns) {
      let match;
      while ((match = regex.exec(code)) !== null) {
        deps.push(match[1]);
      }
    }

    return [...new Set(deps)];
  }

  // 转换模块
  async transformModules() {
    for (const [, module] of this.moduleGraph.nodes) {
      if (module.isExternal) continue;

      let code = module.source;

      // 插件: transform
      const transformed = await this.plugins.hooks.transform.call(code, module.id);
      code = transformed?.code || transformed || code;

      module.transformed = code;
    }
  }

  // 生成产物
  async generateAssets() {
    const modules = Array.from(this.moduleGraph.nodes.values());
    const nonExternal = modules.filter(m => !m.isExternal);

    // 生成 bundle
    const bundle = this.createBundle(nonExternal);
    const hash = computeHash(bundle).slice(0, 8);
    const filename = this.config.output?.filename?.replace('[hash]', hash) || `bundle.${hash}.js`;

    this.assets.set(filename, {
      source: bundle,
      size: Buffer.byteLength(bundle, 'utf-8'),
      type: 'javascript',
    });

    // 生成 HTML
    if (this.config.plugins?.html) {
      const html = this.createHTML(filename);
      this.assets.set('index.html', {
        source: html,
        size: Buffer.byteLength(html, 'utf-8'),
        type: 'html',
      });
    }

    // 插件: generateBundle
    await this.plugins.hooks.generateBundle.call(Object.fromEntries(this.assets));
  }

  // 创建 bundle
  createBundle(modules) {
    const moduleMap = {};
    const idMap = new Map();

    // 分配 ID
    modules.forEach((mod, idx) => idMap.set(mod.id, idx));

    // 生成模块定义
    for (const mod of modules) {
      const id = idMap.get(mod.id);
      const deps = {};
      for (const dep of mod.dependencies) {
        const resolved = this.moduleGraph.nodes.get(dep);
        if (resolved && !resolved.isExternal) {
          deps[dep] = idMap.get(dep);
        }
      }
      moduleMap[id] = {
        factory: `function(require, module, exports) { ${mod.transformed} }`,
        deps,
      };
    }

    return `
(function(modules) {
  var installedModules = {};
  function __require__(moduleId) {
    if (installedModules[moduleId]) return installedModules[moduleId].exports;
    var module = installedModules[moduleId] = { exports: {} };
    modules[moduleId].factory.call(module.exports, __require__, module, module.exports);
    return module.exports;
  }
  return __require__(0);
})(${JSON.stringify(moduleMap)});
`.trim();
  }

  // 创建 HTML
  createHTML(scriptFile) {
    const template = this.config.plugins?.html?.template || '';
    if (template && fs) {
      try {
        return fs.readFileSync(template, 'utf-8').replace(
          '</body>',
          `<script src="/${scriptFile}"></script></body>`
        );
      } catch {
        // 使用默认模板
      }
    }
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Mini Build</title>
</head>
<body>
  <div id="app"></div>
  <script src="/${scriptFile}"></script>
</body>
</html>`;
  }

  // 输出产物
  async emitAssets() {
    const outDir = this.config.output?.path || 'dist';
    await fs.mkdir(outDir, { recursive: true });

    for (const [filename, asset] of this.assets) {
      const filePath = path.join(outDir, filename);
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, asset.source);
      logger.log(`  📄 ${filename} (${(asset.size / 1024).toFixed(2)} KB)`);
    }
  }
}

module.exports = { Compiler };
```

### 6.3 配置文件示例

```javascript
// mini.config.js — 构建配置

const { alias } = require('./src/plugins/alias');
const { css } = require('./src/plugins/css');
const { env } = require('./src/plugins/env');
const { html } = require('./src/plugins/html');
const { analyze } = require('./src/plugins/analyze');
const { copy } = require('./src/plugins/copy');

module.exports = {
  context: __dirname,
  entry: './src/index.js',

  resolve: {
    extensions: ['.js', '.ts', '.jsx', '.tsx', '.vue', '.json'],
    alias: {
      '@': './src',
      '~': './node_modules',
      'vue$': 'vue/dist/vue.runtime.esm.js',
    },
  },

  output: {
    path: 'dist',
    filename: 'bundle.[hash].js',
    publicPath: '/',
  },

  plugins: [
    alias({
      '@': './src',
      '~': './node_modules',
    }),
    css({
      preprocess: 'scss',
      modules: true,
      minimize: true,
    }),
    env({
      'process.env.NODE_ENV': JSON.stringify('production'),
      '__APP_VERSION__': JSON.stringify('1.0.0'),
    }),
    html({
      template: 'public/index.html',
      title: 'My App',
    }),
    analyze({
      open: false,
      filename: 'stats.html',
    }),
    copy({
      patterns: [
        { from: 'public', to: '', globOptions: { ignore: ['**/index.html'] } },
      ],
    }),
  ],
};
```

---

## 七、闭卷自测

### 题目 1: 实现插件钩子系统

```javascript
// 实现一个 Hook 类，支持 tap/tapAsync/tapPromise，并实现 SyncHook 和 AsyncSeriesHook

class Hook {
  constructor(args) {
    this.args = args || [];
    this.taps = [];
  }

  tap(name, fn) {
    this.taps.push({ name, fn, type: 'sync' });
  }

  tapAsync(name, fn) {
    this.taps.push({ name, fn, type: 'async' });
  }

  tapPromise(name, fn) {
    this.taps.push({ name, fn, type: 'promise' });
  }
}

class SyncHook extends Hook {
  call(...args) {
    for (const tap of this.taps) {
      tap.fn(...args.slice(0, this.args.length));
    }
  }
}

class AsyncSeriesHook extends Hook {
  async call(...args) {
    for (const tap of this.taps) {
      if (tap.type === 'promise') {
        await tap.fn(...args.slice(0, this.args.length));
      } else if (tap.type === 'async') {
        await new Promise((resolve) => {
          tap.fn(...args.slice(0, this.args.length), resolve);
        });
      } else {
        tap.fn(...args.slice(0, this.args.length));
      }
    }
  }
}

// 测试
const hooks = {
  buildStart: new SyncHook(),
  emit: new AsyncSeriesHook(['compilation']),
};

hooks.buildStart.tap('Logger', () => console.log('Build started'));
hooks.emit.tapPromise('CSSExtractor', async (compilation) => {
  console.log('Extracting CSS...');
  await new Promise(r => setTimeout(r, 10));
  console.log('CSS extracted');
});

hooks.buildStart.call();
// → Build started

hooks.emit.call({ modules: 10 }).then(() => {
  console.log('Done');
});
// → Extracting CSS...
// → CSS extracted
// → Done
```

### 题目 2: 实现 CSS 嵌套展开

```javascript
function flattenNesting(css) {
  // 递归展开嵌套选择器
  function expand(selector, body) {
    const nestedPattern = /([^{}]+)\s*\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/g;
    let result = '';
    let match;

    while ((match = nestedPattern.exec(body)) !== null) {
      const nestedSelector = match[1].trim();
      const nestedBody = match[2];

      // 处理 & 父选择器引用
      const combined = nestedSelector.startsWith('&')
        ? selector + nestedSelector.slice(1)
        : selector + ' ' + nestedSelector;

      // 递归展开
      result += expand(combined, nestedBody);
    }

    // 提取纯属性 (非嵌套)
    const propsPattern = /([^{};]+;)/g;
    let propMatch;
    while ((propMatch = propsPattern.exec(body)) !== null) {
      const prop = propMatch[1].trim();
      if (!prop.includes('{') && !prop.includes('}')) {
        result += `${selector} { ${prop} }\n`;
      }
    }

    return result;
  }

  // 找到顶层选择器
  const topPattern = /([^{}]+)\s*\{([\s\S]*?)\}/g;
  let result = '';
  let match;

  while ((match = topPattern.exec(css)) !== null) {
    result += expand(match[1].trim(), match[2]);
  }

  return result;
}

// 测试
const input = `
.container {
  padding: 20px;
  .header {
    font-size: 24px;
    &:hover {
      color: red;
    }
  }
  .footer {
    font-size: 12px;
  }
}
`;

console.log(flattenNesting(input));
// .container { padding: 20px; }
// .container .header { font-size: 24px; }
// .container .header:hover { color: red; }
// .container .footer { font-size: 12px; }
```

### 题目 3: 实现 Bundle 体积预算检查

```javascript
function checkBundleBudget(assets, budget) {
  // assets: { filename: { size: number, gzipSize: number } }
  // budget: { maxTotalSize, maxAssetSize, maxGzipSize }

  const violations = [];
  const totalSize = Object.values(assets).reduce((sum, a) => sum + a.size, 0);
  const totalGzip = Object.values(assets).reduce((sum, a) => sum + (a.gzipSize || 0), 0);

  // 检查总大小
  if (budget.maxTotalSize && totalSize > budget.maxTotalSize) {
    violations.push({
      type: 'total-size',
      message: `总大小 ${(totalSize / 1024).toFixed(1)}KB 超过预算 ${(budget.maxTotalSize / 1024).toFixed(1)}KB`,
      severity: 'error',
    });
  }

  // 检查单个文件
  for (const [filename, asset] of Object.entries(assets)) {
    if (budget.maxAssetSize && asset.size > budget.maxAssetSize) {
      violations.push({
        type: 'asset-size',
        file: filename,
        message: `${filename} ${(asset.size / 1024).toFixed(1)}KB 超过 ${(budget.maxAssetSize / 1024).toFixed(1)}KB`,
        severity: 'error',
      });
    }
    if (budget.maxGzipSize && asset.gzipSize > budget.maxGzipSize) {
      violations.push({
        type: 'gzip-size',
        file: filename,
        message: `${filename} gzip ${(asset.gzipSize / 1024).toFixed(1)}KB 超过 ${(budget.maxGzipSize / 1024).toFixed(1)}KB`,
        severity: 'warning',
      });
    }
  }

  return {
    pass: violations.length === 0,
    totalSize,
    totalGzip,
    violations,
  };
}

// 测试
const result = checkBundleBudget(
  {
    'bundle.js': { size: 250000, gzipSize: 80000 },
    'vendor.js': { size: 180000, gzipSize: 60000 },
    'styles.css': { size: 30000, gzipSize: 8000 },
  },
  {
    maxTotalSize: 500000,
    maxAssetSize: 200000,
    maxGzipSize: 100000,
  }
);

console.log(result);
// {
//   pass: false,
//   totalSize: 460000,
//   totalGzip: 148000,
//   violations: [
//     { type: 'asset-size', file: 'bundle.js', message: '...', severity: 'error' },
//     { type: 'gzip-size', file: 'styles.css', message: '...', severity: 'warning' }
//   ]
// }
```

---

## 八、关键收获

1. **通用插件系统** — Hook 系统 (SyncHook/AsyncSeriesHook/Waterfall/Bail) + 插件注册 (apply/transform/resolveId) + 三种风格兼容 (Webpack/Rollup/Vite)
2. **Webpack→Vite 迁移** — 配置映射表 (20+ 配置项) + 迁移 Checklist (5 阶段) + 8 大常见陷阱 + 代码适配 (process.env→import.meta.env)
3. **Bundle 分析** — 手写分析器 (模块提取/依赖扫描/Gzip 估算/Top10/类型分布) + 5 类自动优化建议 + 决策树 (第三方/业务代码/分割)
4. **CSS 管线** — 插件链架构 (PostCSS 风格) + 预处理 (@import/变量/嵌套) + 内置插件 (Autoprefixer/CSS Next/px2rem) + CSS Modules + 压缩
5. **CI/CD 流水线** — 5 阶段 (Lint→Test→Build→E2E→Deploy) + GitHub Actions 完整配置 + 4 层缓存策略 + 6 类性能优化
6. **手写构建系统** — Compiler 核心 (6 步流程) + ModuleGraph 依赖图 + 插件系统 + 产物生成 + 配置文件
7. **工程化思维** — 从原理理解 (v1-v4) 到实战应用 (v5)，形成完整的构建工具知识体系
8. **决策能力** — 迁移决策矩阵、Bundle 优化决策树、CI/CD 缓存策略 — 从 "怎么做" 到 "为什么这样做"

---

*v5 完成。构建工具系列 5 轮迭代，覆盖基础配置 → 进阶架构 → 现代生态 → 算法内核 → 工程化实战。*
*v5 累计产出: ~85KB，5 轮总累计: ~320KB+*
