# 🔧 构建工具专项训练 (Build Tools Training)

**时间：** 2026-04-21 14:00-16:00  
**主题：** Vite/Webpack 配置学习 + 手写简易 Bundler  
**目标：** 理解现代前端构建工具的核心原理

---

## 📚 第一部分：构建工具基础概念

### 为什么需要构建工具？

1. **模块打包** - 将多个模块文件合并成少数几个文件
2. **代码转换** - TypeScript → JavaScript, SCSS → CSS, JSX → JS
3. **资源优化** - 压缩、Tree Shaking、代码分割
4. **开发体验** - 热更新 (HMR)、Source Map、快速启动

### 构建工具演进史

| 工具 | 年份 | 特点 |
|------|------|------|
| Make/Ant | 1976/2000 | 通用构建工具 |
| Grunt | 2012 | 任务 Runner，配置复杂 |
| Gulp | 2013 | 流式处理，代码即配置 |
| Webpack | 2014 | 模块打包器，一切皆模块 |
| Rollup | 2015 | ES Module 优先，适合库 |
| Vite | 2020 | 原生 ESM + ESBuild，极速启动 |
| Turbopack | 2022 | Rust 编写，增量编译 |

---

## 📦 第二部分：Webpack 核心配置

### 基础配置结构

```javascript
// webpack.config.js
const path = require('path');

module.exports = {
  // 1. 入口 - 打包的起点
  entry: './src/index.js',
  
  // 2. 输出 - 打包结果的位置和命名
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'bundle.[contenthash].js',
    clean: true, // 每次构建前清空 dist
  },
  
  // 3. 模式 - development | production | none
  mode: 'development',
  
  // 4. 加载器 - 处理非 JS 文件
  module: {
    rules: [
      {
        test: /\.jsx?$/,
        exclude: /node_modules/,
        use: 'babel-loader',
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader'],
      },
      {
        test: /\.(png|jpg|gif)$/,
        type: 'asset/resource', // Webpack 5 新语法
      },
    ],
  },
  
  // 5. 插件 - 扩展功能
  plugins: [
    new HtmlWebpackPlugin({
      template: './src/index.html',
    }),
  ],
  
  // 6. 开发服务器
  devServer: {
    port: 3000,
    hot: true,
    open: true,
  },
  
  // 7. Source Map
  devtool: 'source-map',
};
```

### 核心概念详解

#### 1. Entry (入口)
```javascript
// 单入口
entry: './src/index.js'

// 多入口
entry: {
  main: './src/index.js',
  admin: './src/admin.js',
}

// 动态入口
entry: () => import('./src/dynamic.js')
```

#### 2. Output (输出)
```javascript
output: {
  // 输出路径 (必须是绝对路径)
  path: path.resolve(__dirname, 'dist'),
  
  // 文件名，支持占位符
  // [name] - 入口名称
  // [contenthash] - 内容哈希 (用于缓存)
  // [chunkhash] - chunk 哈希
  // [hash] - 构建哈希
  filename: '[name].[contenthash].js',
  
  // 公共路径 (CDN 部署时使用)
  publicPath: 'https://cdn.example.com/',
  
  // 库打包配置
  library: {
    name: 'MyLibrary',
    type: 'umd',
    export: 'default',
  },
}
```

#### 3. Loaders (加载器)
```javascript
module: {
  rules: [
    // Babel 转译
    {
      test: /\.jsx?$/,
      exclude: /node_modules/,
      use: {
        loader: 'babel-loader',
        options: {
          presets: ['@babel/preset-env', '@babel/preset-react'],
        },
      },
    },
    
    // TypeScript
    {
      test: /\.tsx?$/,
      use: 'ts-loader',
      exclude: /node_modules/,
    },
    
    // CSS 处理
    {
      test: /\.css$/,
      use: [
        'style-loader',      // 将 CSS 注入 <style> 标签
        'css-loader',        // 解析 @import 和 url()
        'postcss-loader',    // PostCSS 处理
      ],
    },
    
    // SCSS/SASS
    {
      test: /\.scss$/,
      use: [
        'style-loader',
        'css-loader',
        'sass-loader',
      ],
    },
    
    // 图片资源 (Webpack 5)
    {
      test: /\.(png|jpg|gif|svg)$/,
      type: 'asset', // 自动选择 inline 或 resource
      parser: {
        dataUrlCondition: {
          maxSize: 8 * 1024, // 8kb 以下转 base64
        },
      },
    },
    
    // 字体文件
    {
      test: /\.(woff|woff2|eot|ttf|otf)$/,
      type: 'asset/resource',
    },
  ],
}
```

#### 4. Plugins (插件)
```javascript
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const CssMinimizerPlugin = require('css-minimizer-webpack-plugin');
const TerserPlugin = require('terser-webpack-plugin');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');

plugins: [
  // 生成 HTML 文件
  new HtmlWebpackPlugin({
    template: './src/index.html',
    filename: 'index.html',
    minify: {
      collapseWhitespace: true,
      removeComments: true,
    },
  }),
  
  // 提取 CSS 到单独文件
  new MiniCssExtractPlugin({
    filename: '[name].[contenthash].css',
  }),
  
  // 清空输出目录
  new CleanWebpackPlugin(),
  
  // 定义环境变量
  new webpack.DefinePlugin({
    'process.env.NODE_ENV': JSON.stringify('production'),
    '__VERSION__': JSON.stringify('1.0.0'),
  }),
  
  // 复制静态文件
  new CopyPlugin({
    patterns: [
      { from: 'public', to: '.' },
    ],
  }),
]
```

#### 5. Optimization (优化配置)
```javascript
optimization: {
  // Tree Shaking (生产模式默认开启)
  usedExports: true,
  sideEffects: true,
  
  // 代码分割
  splitChunks: {
    chunks: 'all',
    cacheGroups: {
      vendors: {
        test: /[\\/]node_modules[\\/]/,
        name: 'vendors',
        chunks: 'all',
      },
      commons: {
        name: 'commons',
        minChunks: 2,
        priority: -20,
      },
    },
  },
  
  // 压缩配置
  minimize: true,
  minimizer: [
    new TerserPlugin({
      terserOptions: {
        compress: {
          drop_console: true, // 生产环境移除 console
        },
      },
    }),
    new CssMinimizerPlugin(),
  ],
  
  // 运行时代码提取
  runtimeChunk: 'single',
},
```

### 完整的 Webpack 生产配置示例

```javascript
// webpack.prod.js
const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const CssMinimizerPlugin = require('css-minimizer-webpack-plugin');
const TerserPlugin = require('terser-webpack-plugin');
const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');

module.exports = {
  mode: 'production',
  entry: './src/index.js',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'js/[name].[contenthash:8].js',
    clean: true,
    publicPath: '/',
  },
  module: {
    rules: [
      {
        test: /\.jsx?$/,
        exclude: /node_modules/,
        use: 'babel-loader',
      },
      {
        test: /\.css$/,
        use: [
          MiniCssExtractPlugin.loader,
          'css-loader',
          'postcss-loader',
        ],
      },
      {
        test: /\.(png|jpg|gif|svg)$/,
        type: 'asset',
        parser: { dataUrlCondition: { maxSize: 8 * 1024 } },
      },
    ],
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './src/index.html',
      minify: {
        collapseWhitespace: true,
        removeComments: true,
      },
    }),
    new MiniCssExtractPlugin({
      filename: 'css/[name].[contenthash:8].css',
    }),
    new BundleAnalyzerPlugin({
      analyzerMode: 'static',
      openAnalyzer: false,
    }),
  ],
  optimization: {
    splitChunks: {
      chunks: 'all',
      cacheGroups: {
        vendors: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendors',
          chunks: 'all',
        },
      },
    },
    minimize: true,
    minimizer: [
      new TerserPlugin(),
      new CssMinimizerPlugin(),
    ],
    runtimeChunk: 'single',
  },
  devtool: 'source-map',
};
```

---

## ⚡ 第三部分：Vite 核心配置

### Vite vs Webpack

| 特性 | Webpack | Vite |
|------|---------|------|
| 启动速度 | 慢 (需打包整个应用) | 极快 (原生 ESM) |
| HMR | 较慢 | 极快 |
| 生产构建 | 自研打包 | Rollup |
| 配置复杂度 | 高 | 低 |
| 插件生态 | 成熟 | 快速增长 |
| 代码分割 | 手动配置 | 自动优化 |

### Vite 基础配置

```javascript
// vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  // 1. 插件
  plugins: [react()],
  
  // 2. 根目录
  root: '.',
  
  // 3. 公共目录
  publicDir: 'public',
  
  // 4. 输出目录
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    minify: 'terser',
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
        },
      },
    },
  },
  
  // 5. 开发服务器
  server: {
    port: 3000,
    open: true,
    cors: true,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
  
  // 6. 路径别名
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@components': path.resolve(__dirname, 'src/components'),
    },
  },
  
  // 7. CSS 配置
  css: {
    preprocessorOptions: {
      scss: {
        additionalData: `@import "@/styles/variables.scss";`,
      },
    },
    modules: {
      localsConvention: 'camelCase',
    },
  },
  
  // 8. 优化依赖预构建
  optimizeDeps: {
    include: ['react', 'react-dom'],
    exclude: ['@custom/package'],
  },
  
  // 9. 环境变量
  define: {
    __APP_VERSION__: JSON.stringify('1.0.0'),
  },
});
```

### Vite 核心原理

#### 1. 开发环境：原生 ESM + ESBuild

```
┌─────────────────────────────────────────────────────┐
│                    浏览器                            │
│                      ↓                              │
│              请求 /src/main.js                       │
│                      ↓                              │
│  ┌─────────────────────────────────────────────┐    │
│  │                  Vite Server                 │    │
│  │  • 拦截 ESM 请求                              │    │
│  │  • ESBuild 预构建依赖 (node_modules)          │    │
│  │  • 按需转换源码 (TSX → JS, SCSS → CSS)       │    │
│  └─────────────────────────────────────────────┘    │
│                      ↓                              │
│              返回转换后的 ESM                         │
└─────────────────────────────────────────────────────┘
```

#### 2. 生产环境：Rollup 打包

```javascript
// Vite 生产构建流程
import { build } from 'vite';

build({
  build: {
    rollupOptions: {
      input: 'index.html',
      output: {
        dir: 'dist',
        format: 'es',
      },
    },
  },
});
```

#### 3. HMR 原理

```javascript
// Vite HMR 核心逻辑 (简化版)
// 1. 客户端注入 HMR 运行时
if (import.meta.hot) {
  import.meta.hot.accept((newModule) => {
    // 热更新逻辑
    updateComponent(newModule);
  });
}

// 2. 服务端监听文件变化
// 3. 推送更新到客户端
// 4. 客户端执行模块替换
```

---

## 🔨 第四部分：手写简易 Bundler

### 目标
实现一个最小可用的模块打包器，理解打包的核心原理。

### 核心步骤

1. **读取入口文件** - 获取源代码
2. **解析依赖** - 分析 `import`/`require` 语句
3. **转换代码** - Babel 转译 (可选)
4. **构建依赖图** - 记录模块关系
5. **生成打包文件** - 将所有模块包装成一个 IIFE

### 实现代码

```javascript
// simple-bundler.js
const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const { transformFromAstSync } = require('@babel/core');

class SimpleBundler {
  constructor(options) {
    this.entry = options.entry;
    this.output = options.output;
    this.modules = []; // 存储所有模块信息
  }

  // 1. 读取文件内容
  readFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    return content;
  }

  // 2. 解析文件，获取 AST 和依赖
  parseFile(filePath) {
    const content = this.readFile(filePath);
    const absolutePath = path.resolve(filePath);
    const dir = path.dirname(absolutePath);

    // 解析为 AST
    const ast = parser.parse(content, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript'],
    });

    // 收集依赖
    const dependencies = [];
    traverse(ast, {
      ImportDeclaration: ({ node }) => {
        const relativePath = node.source.value;
        // 解析相对路径为绝对路径
        const absoluteDepPath = path.resolve(dir, relativePath);
        const ext = path.extname(absoluteDepPath);
        // 处理无扩展名的情况
        const finalPath = ext ? absoluteDepPath : `${absoluteDepPath}.js`;
        dependencies.push(finalPath);
        // 更新 AST 中的路径为相对路径 (相对于当前模块)
        node.source.value = './' + path.basename(finalPath);
      },
    });

    // 转换代码 (ES6 → ES5, 可选)
    const { code } = transformFromAstSync(ast, content, {
      presets: ['@babel/preset-env'],
    });

    return {
      filePath: absolutePath,
      code,
      dependencies,
    };
  }

  // 3. 构建依赖图 (BFS 遍历)
  buildGraph(entry) {
    const queue = [entry];
    const visited = new Set();

    while (queue.length > 0) {
      const currentPath = queue.shift();
      
      if (visited.has(currentPath)) continue;
      visited.add(currentPath);

      const moduleInfo = this.parseFile(currentPath);
      this.modules.push(moduleInfo);

      // 将依赖加入队列
      moduleInfo.dependencies.forEach((dep) => {
        if (!visited.has(dep)) {
          queue.push(dep);
        }
      });
    }

    return this.modules;
  }

  // 4. 生成打包文件
  generateBundle() {
    const modulesCode = this.modules
      .map((module) => {
        // 为每个模块生成一个唯一 ID
        const moduleId = this.modules.indexOf(module);
        const relativePath = './' + path.basename(module.filePath);
        
        return `
  '${relativePath}': (function(require, module, exports) {
    ${module.code}
  }),
        `.trim();
      })
      .join('\n');

    // 创建依赖映射表
    const depsMap = this.modules
      .map((module) => {
        const relativePath = './' + path.basename(module.filePath);
        const deps = {};
        module.dependencies.forEach((dep, index) => {
          deps[`./${path.basename(dep)}`] = './' + path.basename(dep);
        });
        return `'${relativePath}': ${JSON.stringify(deps)}`;
      })
      .join(',\n');

    // 生成最终打包代码
    const bundle = `
(function(modules, depsMap) {
  // 简单的 CommonJS require 实现
  function require(moduleId) {
    if (!require.cache[moduleId]) {
      const fn = modules[moduleId];
      const module = { exports: {} };
      require.cache[moduleId] = module;
      
      // 创建子 require，处理相对路径
      const localRequire = (path) => {
        const resolved = depsMap[moduleId][path];
        return require(resolved);
      };
      
      fn(localRequire, module, module.exports);
    }
    return require.cache[moduleId].exports;
  }
  
  require.cache = {};
  
  // 执行入口模块
  require('./index.js');
})({
${modulesCode}
}, {
${depsMap}
});
    `.trim();

    return bundle;
  }

  // 5. 输出到文件
  emit() {
    const bundle = this.generateBundle();
    const outputPath = path.resolve(this.output);
    
    // 确保输出目录存在
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(outputPath, bundle);
    console.log(`✅ Bundle generated: ${outputPath}`);
    console.log(`📦 Total modules: ${this.modules.length}`);
  }

  // 主入口
  build() {
    console.log('🔨 Starting build...');
    console.log(`📥 Entry: ${this.entry}`);
    console.log(`📤 Output: ${this.output}`);
    
    this.buildGraph(this.entry);
    this.emit();
    
    console.log('✨ Build complete!');
  }
}

// 使用示例
const bundler = new SimpleBundler({
  entry: './src/index.js',
  output: './dist/bundle.js',
});

bundler.build();
```

### 测试示例

```javascript
// src/index.js
import { add } from './math.js';
import { greet } from './utils.js';

console.log(greet('World'));
console.log('2 + 3 =', add(2, 3));

// src/math.js
export function add(a, b) {
  return a + b;
}

export function subtract(a, b) {
  return a - b;
}

// src/utils.js
export function greet(name) {
  return `Hello, ${name}!`;
}
```

### 运行打包器

```bash
# 安装依赖
npm install @babel/parser @babel/traverse @babel/core @babel/preset-env

# 运行
node simple-bundler.js

# 输出:
# 🔨 Starting build...
# 📥 Entry: ./src/index.js
# 📤 Output: ./dist/bundle.js
# ✅ Bundle generated: /path/to/dist/bundle.js
# 📦 Total modules: 3
# ✨ Build complete!
```

### 打包后的代码结构

```javascript
(function(modules, depsMap) {
  function require(moduleId) {
    if (!require.cache[moduleId]) {
      const fn = modules[moduleId];
      const module = { exports: {} };
      require.cache[moduleId] = module;
      
      const localRequire = (path) => {
        const resolved = depsMap[moduleId][path];
        return require(resolved);
      };
      
      fn(localRequire, module, module.exports);
    }
    return require.cache[moduleId].exports;
  }
  
  require.cache = {};
  require('./index.js');
})({
  './index.js': (function(require, module, exports) {
    // ... math.js 的代码
  }),
  './math.js': (function(require, module, exports) {
    // ... math.js 的代码
  }),
  './utils.js': (function(require, module, exports) {
    // ... utils.js 的代码
  }),
}, {
  './index.js': { './math.js': './math.js', './utils.js': './utils.js' },
  './math.js': {},
  './utils.js': {},
});
```

---

## 🎯 第五部分：核心原理总结

### 打包器核心流程

```
┌─────────────────────────────────────────────────────────────┐
│                      打包器工作流程                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. 读取入口文件                                             │
│         ↓                                                   │
│  2. 解析 AST，识别 import/require                            │
│         ↓                                                   │
│  3. 收集依赖，构建依赖图                                     │
│         ↓                                                   │
│  4. 转换代码 (Babel/TypeScript)                             │
│         ↓                                                   │
│  5. 生成打包代码 (IIFE + 模块系统)                           │
│         ↓                                                   │
│  6. 输出到文件                                               │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 关键概念对比

| 概念 | Webpack | Vite | 手写 Bundler |
|------|---------|------|-------------|
| 模块解析 | 自研 | 原生 ESM | @babel/parser |
| 代码转换 | Babel/TS-Loader | ESBuild | @babel/core |
| 依赖图 | 完整构建 | 按需加载 | BFS 遍历 |
| 输出格式 | CommonJS/ESM | ESM | IIFE |
| HMR | 基于 WebSocket | 基于 ESM | 不支持 |
| Tree Shaking | 基于 sideEffects | 基于 ESM | 不支持 |

### 生产优化技术

1. **Tree Shaking** - 移除未使用代码
   ```javascript
   // package.json
   {
     "sideEffects": false, // 或 ["*.css", "*.scss"]
   }
   ```

2. **Code Splitting** - 代码分割
   ```javascript
   // 动态导入
   const module = await import('./heavy-module.js');
   
   // Webpack 魔法注释
   const module = await import(
     /* webpackChunkName: "heavy" */ './heavy-module.js'
   );
   ```

3. **Scope Hoisting** - 作用域提升
   ```javascript
   // webpack.config.js
   optimization: {
     concatenateModules: true,
   }
   ```

4. **缓存优化**
   ```javascript
   // 使用 contenthash
   filename: '[name].[contenthash].js'
   
   // 提取运行时代码
   runtimeChunk: 'single'
   ```

---

## 📝 实战练习

### 练习 1: Webpack 配置实践
创建一个完整的 Webpack 配置，支持:
- React + TypeScript
- SCSS 样式
- 图片资源优化
- 生产环境优化

### 练习 2: Vite 项目迁移
将一个现有 Webpack 项目迁移到 Vite，对比:
- 启动速度
- HMR 速度
- 构建产物大小

### 练习 3: 扩展手写 Bundler
为简易 Bundler 添加:
- CSS 文件支持
- Tree Shaking
- Source Map 生成

---

## 📚 参考资源

- [Webpack 官方文档](https://webpack.js.org/)
- [Vite 官方文档](https://vitejs.dev/)
- [Rollup 官方文档](https://rollupjs.org/)
- [Babel 官方文档](https://babeljs.io/)
- [ESBuild](https://esbuild.github.io/)

---

## 🚀 第六部分：esbuild 深度解析

### esbuild 为什么快？

| 技术 | Webpack | esbuild |
|------|---------|---------|
| 语言 | JavaScript | Go |
| 并行 | 单线程/有限 worker | 原生多核并行 |
| 解析 | acorn (慢) | 自研 Go 解析器 (快 10-100x) |
| 内存 | 多次遍历 AST | 单次遍历 + 零拷贝 |
| 缓存 | 文件系统缓存 | 内存级缓存 |

### esbuild 核心 API

```javascript
// esbuild.js
const esbuild = require('esbuild');

// 1. 基础构建
esbuild.build({
  entryPoints: ['src/index.tsx'],
  bundle: true,
  outfile: 'dist/bundle.js',
  minify: true,
  sourcemap: true,
  target: 'es2020',
  format: 'esm',
  splitting: true, // 代码分割
  metafile: true,  // 生成元数据
}).then(result => {
  // 分析构建结果
  require('fs').writeFileSync(
    'dist/meta.json',
    JSON.stringify(result.metafile)
  );
});

// 2. 开发服务器 + HMR
esbuild.serve(
  { servedir: 'dist' },
  {
    entryPoints: ['src/index.tsx'],
    bundle: true,
    outfile: 'dist/bundle.js',
  }
).then(server => {
  console.log('Server running at', server.host, server.port);
});

// 3. 转换 API (不打包)
const result = await esbuild.transform(code, {
  loader: 'tsx',
  target: 'es2020',
  jsx: 'automatic', // React 17+ JSX transform
});

// 4. 服务 API (持续构建)
const ctx = await esbuild.context({
  entryPoints: ['src/index.tsx'],
  bundle: true,
  outfile: 'dist/bundle.js',
  sourcemap: 'inline',
});

// 开发模式：watch + serve
await ctx.watch();
const { host, port } = await ctx.serve({ servedir: 'dist' });

// 生产模式：rebuild
await ctx.rebuild();
await ctx.dispose();
```

### esbuild vs Webpack 性能对比

```
项目: 1000 个模块的 React 应用

首次启动:
  Webpack:  3.2s
  esbuild:  0.15s  (21x 快)

HMR 更新:
  Webpack:  350ms
  esbuild:  20ms   (17x 快)

生产构建:
  Webpack:  8.5s
  esbuild:  0.4s   (21x 快)

产物大小 (Webpack 更优):
  Webpack:  245KB (gzip)
  esbuild:  268KB (gzip)  (略大，因为 Tree Shaking 不如 Webpack 激进)
```

### esbuild 插件系统

```javascript
// my-plugin.js
const esbuild = require('esbuild');

// 自定义插件：Markdown 文件加载器
const markdownPlugin = {
  name: 'markdown',
  setup(build) {
    // 拦截 .md 文件的解析
    build.onResolve({ filter: /\.md$/ }, args => {
      return {
        path: args.path,
        namespace: 'markdown-ns',
        pluginData: { dir: path.dirname(args.path) },
      };
    });

    // 加载并转换 .md 文件
    build.onLoad({ filter: /\.md$/, namespace: 'markdown-ns' }, args => {
      const content = require('fs').readFileSync(args.path, 'utf-8');
      const html = require('marked')(content);
      
      return {
        contents: `
          export default ${JSON.stringify(html)};
          export const raw = ${JSON.stringify(content)};
        `,
        loader: 'js',
      };
    });
  },
};

// 自定义插件：SVG Sprite 生成器
const svgSpritePlugin = {
  name: 'svg-sprite',
  setup(build) {
    build.onResolve({ filter: /\.sprite\.svg$/ }, args => ({
      path: args.path,
      namespace: 'sprite',
    }));

    build.onLoad({ filter: /\.sprite\.svg$/, namespace: 'sprite' }, async args => {
      const dir = path.dirname(args.path);
      const files = await require('fs').promises.readdir(dir);
      const svgs = files
        .filter(f => f.endsWith('.svg') && f !== path.basename(args.path))
        .map(f => require('fs').readFileSync(path.join(dir, f), 'utf-8'));
      
      const sprite = `<svg xmlns="http://www.w3.org/2000/svg">${svgs.join('')}</svg>`;
      
      return {
        contents: `
          const div = document.createElement('div');
          div.style.display = 'none';
          div.innerHTML = ${JSON.stringify(sprite)};
          document.body.insertBefore(div, document.body.firstChild);
          export default ${JSON.stringify(sprite)};
        `,
        loader: 'js',
      };
    });
  },
};

// 使用插件
esbuild.build({
  entryPoints: ['src/index.tsx'],
  bundle: true,
  outfile: 'dist/bundle.js',
  plugins: [markdownPlugin, svgSpritePlugin],
});
```

---

## 🔥 第七部分：HMR (热模块替换) 深入原理

### HMR 完整工作流程

```
┌──────────────────────────────────────────────────────────────────┐
│                        HMR 工作流程                               │
│                                                                  │
│  ┌─────────┐    文件变化     ┌──────────────┐                    │
│  │ 编辑器   │ ────────────→ │  文件监听器    │                    │
│  │ (VSCode) │               │ (chokidar)     │                    │
│  └─────────┘               └──────┬─────────┘                    │
│                                   │ 触发更新                        │
│                                   ↓                               │
│                            ┌──────────────┐                       │
│                            │  增量编译     │                       │
│                            │ (只编译变化模块)│                      │
│                            └──────┬────────┘                       │
│                                   │ 生成更新 chunk                   │
│                                   ↓                               │
│  ┌────────────┐   WebSocket    ┌──────────────┐                   │
│  │  浏览器     │ ←──────────── │  开发服务器   │                   │
│  │ (HMR Runtime)│   推送更新    │  (DevServer)  │                   │
│  └─────┬──────┘               └──────────────┘                   │
│        │                                                       │
│        ↓                                                       │
│  ┌────────────┐                                               │
│  │ 1. 下载更新 │ → .hot-update.js                              │
│  │ 2. 应用更新 │ → 执行模块替换逻辑                               │
│  │ 3. 回调     │ → import.meta.hot.accept()                     │
│  └────────────┘                                               │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### 手写 HMR Runtime

```javascript
// hmr-runtime.js — 浏览器端 HMR 客户端
class HMRClient {
  constructor(options = {}) {
    this.host = options.host || 'localhost';
    this.port = options.port || 3000;
    this.handlers = new Map(); // 模块热更新处理器
    this.ws = null;
    this.connect();
  }

  connect() {
    this.ws = new WebSocket(
      `ws://${this.host}:${this.port}/__hmr`
    );

    this.ws.onmessage = async (event) => {
      const message = JSON.parse(event.data);
      
      switch (message.type) {
        case 'update':
          await this.handleUpdate(message);
          break;
        case 'full-reload':
          window.location.reload();
          break;
        case 'connected':
          console.log('[HMR] Connected');
          break;
      }
    };

    this.ws.onclose = () => {
      // 断线重连
      setTimeout(() => this.connect(), 3000);
    };
  }

  async handleUpdate(message) {
    const { moduleId, updateUrl } = message;
    
    try {
      // 1. 获取当前模块的处理器
      const handler = this.handlers.get(moduleId);
      
      // 2. 调用 dispose 回调 (清理旧模块状态)
      if (handler) {
        const disposeData = {};
        handler.dispose?.(disposeData);
        handler.disposeData = disposeData;
      }

      // 3. 从服务器下载更新后的模块
      const response = await fetch(updateUrl);
      const moduleCode = await response.text();

      // 4. 执行新模块代码 (使用 eval 或 new Function)
      const newModule = { exports: {} };
      const fn = new Function(
        'require', 'module', 'exports', 'importMeta',
        moduleCode
      );
      fn(
        (id) => this.require(id),
        newModule,
        newModule.exports,
        { hot: this.createHotContext(moduleId) }
      );

      // 5. 替换模块缓存
      this.moduleCache.set(moduleId, newModule);

      // 6. 调用 accept 回调 (应用新模块)
      if (handler) {
        handler.accept?.(newModule.exports);
      }

      console.log(`[HMR] Updated: ${moduleId}`);
    } catch (err) {
      console.error(`[HMR] Update failed: ${moduleId}`, err);
      // 降级为全页面刷新
      window.location.reload();
    }
  }

  // 模块 require 实现 (带缓存)
  require(moduleId) {
    if (this.moduleCache.has(moduleId)) {
      return this.moduleCache.get(moduleId).exports;
    }
    // 首次加载走正常流程
    return this.loadModule(moduleId);
  }

  // 创建模块的 hot 上下文
  createHotContext(moduleId) {
    return {
      accept: (dep, callback) => {
        if (typeof dep === 'function') {
          callback = dep;
          dep = undefined;
        }
        this.handlers.set(moduleId, {
          accept: callback,
          dispose: null,
        });
      },
      dispose: (callback) => {
        const handler = this.handlers.get(moduleId) || {};
        handler.dispose = callback;
        this.handlers.set(moduleId, handler);
      },
      invalidate: () => {
        window.location.reload();
      },
    };
  }

  loadModule(moduleId) {
    // 首次加载逻辑 (同 bundler 的 require)
    const module = { exports: {} };
    this.moduleCache.set(moduleId, module);
    const fn = this.moduleFunctions.get(moduleId);
    fn(
      (id) => this.require(id),
      module,
      module.exports,
      { hot: this.createHotContext(moduleId) }
    );
    return module.exports;
  }
}

// 浏览器端使用
const hmr = new HMRClient({ host: 'localhost', port: 3000 });
```

### HMR 服务端实现

```javascript
// hmr-server.js — 开发服务器 HMR 端
const http = require('http');
const WebSocket = require('ws');
const chokidar = require('chokidar');
const fs = require('fs');
const path = require('path');

class HMRSserver {
  constructor(options = {}) {
    this.root = options.root || process.cwd();
    this.port = options.port || 3000;
    this.clients = new Set();
    this.moduleGraph = new Map(); // 模块依赖图
    this.watcher = null;
  }

  start() {
    // 1. 创建 HTTP 服务器
    const server = http.createServer((req, res) => {
      // 处理 HMR 客户端请求
      if (req.url === '/__hmr/client.js') {
        res.writeHead(200, { 'Content-Type': 'application/javascript' });
        res.end(fs.readFileSync(
          path.join(__dirname, 'hmr-runtime.js'), 'utf-8'
        ));
        return;
      }

      // 处理更新 chunk 请求
      if (req.url.match(/\.hot-update\.js$/)) {
        const moduleId = req.url.split('/').pop().replace('.hot-update.js', '');
        const updateCode = this.generateUpdateChunk(moduleId);
        res.writeHead(200, { 'Content-Type': 'application/javascript' });
        res.end(updateCode);
        return;
      }

      // 处理普通文件请求
      this.serveFile(req, res);
    });

    // 2. 创建 WebSocket 服务器
    const wss = new WebSocket.Server({ path: '/__hmr', server });
    wss.on('connection', (ws) => {
      this.clients.add(ws);
      ws.send(JSON.stringify({ type: 'connected' }));
      ws.on('close', () => this.clients.delete(ws));
    });

    // 3. 监听文件变化
    this.watcher = chokidar.watch(this.root, {
      ignored: /node_modules|dist|\.git/,
      persistent: true,
    });

    this.watcher.on('change', (filePath) => {
      this.handleFileChange(filePath);
    });

    server.listen(this.port, () => {
      console.log(`🔥 HMR Server running at http://localhost:${this.port}`);
    });
  }

  handleFileChange(filePath) {
    // 1. 重新解析文件，获取新的依赖图
    const moduleId = this.getModuleId(filePath);
    const newDeps = this.parseDependencies(filePath);
    
    // 2. 更新模块图
    this.moduleGraph.set(moduleId, {
      file: filePath,
      deps: newDeps,
      timestamp: Date.now(),
    });

    // 3. 生成更新 chunk
    const updateCode = this.generateUpdateChunk(moduleId);

    // 4. 推送更新到所有客户端
    this.broadcast({
      type: 'update',
      moduleId,
      updateUrl: `/${moduleId}.hot-update.js`,
      code: updateCode,
    });

    console.log(`[HMR] ${moduleId} updated`);
  }

  generateUpdateChunk(moduleId) {
    const filePath = this.moduleGraph.get(moduleId)?.file;
    if (!filePath) return '';
    
    const code = fs.readFileSync(filePath, 'utf-8');
    // 将模块代码包装为可执行的更新 chunk
    return `
      (function() {
        const module = { exports: {} };
        ${code}
        if (window.__HMR_HANDLER__) {
          window.__HMR_HANDLER__('${moduleId}', module.exports);
        }
      })();
    `;
  }

  broadcast(message) {
    const data = JSON.stringify(message);
    this.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    });
  }

  getModuleId(filePath) {
    return path.relative(this.root, filePath).replace(/\\/g, '/');
  }

  parseDependencies(filePath) {
    const code = fs.readFileSync(filePath, 'utf-8');
    const deps = [];
    // 简单正则匹配 import 语句
    const importRegex = /import\s+.*?\s+from\s+['"](.+?)['"]/g;
    let match;
    while ((match = importRegex.exec(code)) !== null) {
      deps.push(match[1]);
    }
    return deps;
  }

  serveFile(req, res) {
    let filePath = path.join(this.root, req.url);
    if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
      filePath = path.join(filePath, 'index.html');
    }
    if (fs.existsSync(filePath)) {
      const ext = path.extname(filePath);
      const mimeTypes = {
        '.html': 'text/html',
        '.js': 'application/javascript',
        '.css': 'text/css',
        '.json': 'application/json',
      };
      res.writeHead(200, {
        'Content-Type': mimeTypes[ext] || 'application/octet-stream',
      });
      res.end(fs.readFileSync(filePath));
    } else {
      res.writeHead(404);
      res.end('Not Found');
    }
  }
}

// 启动 HMR 服务器
const server = new HMRSserver({
  root: './src',
  port: 3000,
});
server.start();
```

---

## 🌳 第八部分：Tree Shaking 深入实现

### Tree Shaking 原理

```
Tree Shaking 核心：基于 ESM 静态分析的死代码消除

1. 静态分析 — ESM 的 import/export 在编译时可确定
2. 构建依赖图 — 标记每个模块的导出和引用
3. 可达性分析 — 从入口开始标记可达的导出
4. 消除死代码 — 移除不可达的导出

与 Uglify/Terser 的区别:
  - Tree Shaking: 模块级 (移除整个未使用的 export)
  - Terser: 代码级 (移除未使用的变量/函数)
```

### Tree Shaking 实现 (手写)

```javascript
// tree-shaker.js — 简易 Tree Shaking 实现
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const generate = require('@babel/generator').default;
const t = require('@babel/types');

class TreeShaker {
  constructor() {
    this.moduleGraph = new Map(); // 模块依赖图
    this.usedExports = new Set(); // 被使用的导出
  }

  // 1. 构建模块依赖图
  buildGraph(entryPath) {
    const queue = [entryPath];
    const visited = new Set();

    while (queue.length > 0) {
      const filePath = queue.shift();
      if (visited.has(filePath)) continue;
      visited.add(filePath);

      const code = require('fs').readFileSync(filePath, 'utf-8');
      const ast = parser.parse(code, {
        sourceType: 'module',
        plugins: ['jsx'],
      });

      // 收集模块的导出
      const exports = [];
      traverse(ast, {
        ExportNamedDeclaration({ node }) {
          if (t.isDeclaration(node.declaration)) {
            exports.push(node.declaration.id.name);
          } else if (t.isVariableDeclaration(node.declaration)) {
            node.declaration.declarations.forEach(d => {
              exports.push(d.id.name);
            });
          }
        },
        ExportDefaultDeclaration() {
          exports.push('default');
        },
      });

      // 收集模块的导入
      const imports = [];
      traverse(ast, {
        ImportDeclaration({ node }) {
          const source = node.source.value;
          const specifiers = node.specifiers.map(s => {
            if (t.isImportDefaultSpecifier(s)) {
              return { local: s.local.name, imported: 'default' };
            }
            if (t.isImportSpecifier(s)) {
              return { local: s.local.name, imported: s.imported.name };
            }
            return { local: s.local.name, imported: '*' };
          });
          imports.push({ source, specifiers });
        },
      });

      this.moduleGraph.set(filePath, {
        ast,
        code,
        exports,
        imports,
      });

      // 将依赖加入队列
      imports.forEach(imp => {
        const depPath = this.resolvePath(filePath, imp.source);
        if (depPath && !visited.has(depPath)) {
          queue.push(depPath);
        }
      });
    }
  }

  // 2. 标记可达的导出 (从入口开始)
  markUsedExports(entryPath) {
    const queue = [entryPath];
    const visited = new Set();

    while (queue.length > 0) {
      const filePath = queue.shift();
      if (visited.has(filePath)) continue;
      visited.add(filePath);

      const module = this.moduleGraph.get(filePath);
      if (!module) return;

      // 标记该模块被使用
      module.imports.forEach(imp => {
        const depPath = this.resolvePath(filePath, imp.source);
        if (!depPath) return;

        const depModule = this.moduleGraph.get(depPath);
        if (!depModule) return;

        // 标记被导入的导出为"已使用"
        imp.specifiers.forEach(spec => {
          const exportedName = spec.imported === '*' 
            ? '__all__' 
            : spec.imported;
          
          this.usedExports.add(`${depPath}:${exportedName}`);

          // 如果是 namespace import，标记所有导出
          if (spec.imported === '*') {
            depModule.exports.forEach(exp => {
              this.usedExports.add(`${depPath}:${exp}`);
            });
          }
        });

        queue.push(depPath);
      });
    }
  }

  // 3. 移除未使用的导出
  shake() {
    const results = new Map();

    for (const [filePath, module] of this.moduleGraph) {
      const { ast, code } = module;
      let changed = false;

      // 遍历 AST，移除未使用的导出
      traverse(ast, {
        ExportNamedDeclaration(path) {
          if (t.isFunctionDeclaration(path.node.declaration)) {
            const name = path.node.declaration.id.name;
            if (!this.isUsed(filePath, name)) {
              path.remove();
              changed = true;
            }
          } else if (t.isVariableDeclaration(path.node.declaration)) {
            const decls = path.node.declaration.declarations;
            const kept = decls.filter(d => {
              return this.isUsed(filePath, d.id.name);
            });
            if (kept.length === 0) {
              path.remove();
              changed = true;
            } else if (kept.length < decls.length) {
              path.node.declaration.declarations = kept;
              changed = true;
            }
          }
        },
      }, {
        isUsed: (modPath, exportName) => {
          return this.usedExports.has(`${modPath}:${exportName}`)
            || this.usedExports.has(`${modPath}:__all__`);
        },
      });

      if (changed) {
        const result = generate(ast, {}, code);
        results.set(filePath, result.code);
      }
    }

    return results;
  }

  resolvePath(fromPath, importSource) {
    if (importSource.startsWith('.') || importSource.startsWith('/')) {
      const dir = require('path').dirname(fromPath);
      let resolved = require('path').resolve(dir, importSource);
      // 尝试添加扩展名
      for (const ext of ['.js', '.jsx', '.ts', '.tsx']) {
        if (require('fs').existsSync(resolved + ext)) {
          return resolved + ext;
        }
      }
      if (require('fs').existsSync(resolved)) return resolved;
    }
    return null; // 第三方模块不处理
  }

  // 主入口
  shakeEntry(entryPath) {
    console.log('🌳 Starting Tree Shaking...');
    console.log(`📥 Entry: ${entryPath}`);
    
    this.buildGraph(entryPath);
    console.log(`📦 Modules in graph: ${this.moduleGraph.size}`);
    
    this.markUsedExports(entryPath);
    console.log(`✅ Used exports: ${this.usedExports.size}`);
    
    const results = this.shake();
    console.log(`🗑️  Removed exports from ${results.size} modules`);
    
    return results;
  }
}

// 使用示例
const shaker = new TreeShaker();
const shakenModules = shaker.shakeEntry('./src/index.js');

for (const [filePath, code] of shakenModules) {
  require('fs').writeFileSync(filePath, code);
  console.log(`✍️  Updated: ${filePath}`);
}
```

### Tree Shaking 实战示例

```javascript
// math.js — 包含多个导出
export function add(a, b) {
  return a + b;
}

export function subtract(a, b) {
  return a - b;
}

export function multiply(a, b) {
  return a * b;
}

export function divide(a, b) {
  if (b === 0) throw new Error('Division by zero');
  return a / b;
}

export const PI = 3.14159;
export const E = 2.71828;

// index.js — 只使用部分导出
import { add, PI } from './math.js';

console.log(add(2, 3)); // 5
console.log(PI);        // 3.14159

// Tree Shaking 后 (math.js 被精简):
// export function add(a, b) { return a + b; }
// export const PI = 3.14159;
// subtract / multiply / divide / E 被移除 ✅
```

### sideEffects 配置

```json
// package.json
{
  "name": "my-library",
  "sideEffects": false,
  // 或指定有副作用的文件
  "sideEffects": [
    "*.css",
    "*.scss",
    "./src/polyfill.js",
    "./src/global-styles.css"
  ]
}
```

---

## 📊 第九部分：Bundle 分析与优化

### Bundle Analyzer 使用

```javascript
// webpack.config.js
const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');

module.exports = {
  plugins: [
    new BundleAnalyzerPlugin({
      analyzerMode: 'static',    // 生成静态 HTML
      openAnalyzer: false,       // 不自动打开浏览器
      reportFilename: 'report.html',
      defaultSizes: 'gzip',      // 显示 gzip 后大小
    }),
  ],
};

// 命令行分析
// npx webpack-bundle-analyzer dist/stats.json
```

### 手动 Bundle 分析

```javascript
// bundle-analyzer.js
const fs = require('fs');
const zlib = require('zlib');

function analyzeBundle(bundlePath) {
  const code = fs.readFileSync(bundlePath, 'utf-8');
  const gzipSize = zlib.gzipSync(code).length;
  
  // 分析模块大小分布
  const moduleRegex = /"([^"]+)":\s*function\(/g;
  const modules = [];
  let match;
  
  while ((match = moduleRegex.exec(code)) !== null) {
    const moduleName = match[1];
    // 找到模块的起始和结束位置
    const start = match.index;
    const depth = findModuleEnd(code, start);
    const moduleCode = code.slice(start, depth);
    
    modules.push({
      name: moduleName,
      size: Buffer.byteLength(moduleCode, 'utf-8'),
      gzipSize: zlib.gzipSync(moduleCode).length,
    });
  }
  
  // 排序输出
  modules.sort((a, b) => b.size - a.size);
  
  console.log('\n📊 Bundle 分析结果:');
  console.log(`总大小: ${(Buffer.byteLength(code) / 1024).toFixed(2)} KB`);
  console.log(`Gzip 大小: ${(gzipSize / 1024).toFixed(2)} KB`);
  console.log(`模块数: ${modules.length}\n`);
  
  console.log('Top 10 最大模块:');
  modules.slice(0, 10).forEach((mod, i) => {
    const pct = ((mod.size / Buffer.byteLength(code)) * 100).toFixed(1);
    console.log(
      `  ${i + 1}. ${mod.name} — ${(mod.size / 1024).toFixed(2)} KB (${pct}%)`
    );
  });
  
  return modules;
}

function findModuleEnd(code, start) {
  let depth = 0;
  let inString = false;
  let stringChar = '';
  
  for (let i = start; i < code.length; i++) {
    const char = code[i];
    
    if (inString) {
      if (char === stringChar && code[i - 1] !== '\\') {
        inString = false;
      }
      continue;
    }
    
    if (char === '"' || char === "'" || char === '`') {
      inString = true;
      stringChar = char;
      continue;
    }
    
    if (char === '{') depth++;
    if (char === '}') {
      depth--;
      if (depth === 0) return i + 1;
    }
  }
  
  return code.length;
}

// 使用
analyzeBundle('./dist/bundle.js');
```

### 优化 Checklist

```
📦 Bundle 优化 Checklist:

✅ Tree Shaking
  - 使用 ESM 模块 (而非 CommonJS)
  - package.json 设置 sideEffects
  - 避免 barrel files (index.js re-export)

✅ Code Splitting
  - 路由级分割 (React.lazy / import())
  - 组件级分割 (重型组件按需加载)
  - 第三方库分割 (vendor chunk)

✅ 依赖优化
  - 替换大型库 (moment → dayjs, lodash → lodash-es)
  - 使用 tree-shakeable 的包
  - 定期审计依赖 (npm ls / depcheck)

✅ 图片优化
  - WebP / AVIF 格式
  - 响应式图片 (srcset)
  - 内联小图片 (< 8KB base64)

✅ 缓存策略
  - contenthash 文件名
  - 提取 runtime chunk
  - 长期缓存 + 增量更新

✅ 压缩
  - gzip / brotli 压缩
  - Terser 压缩 JS
  - CSSNano 压缩 CSS
  - HTMLMinifier 压缩 HTML
```

---

## 🏗️ 第十部分：完整实战 — 从零搭建构建系统

### 项目结构

```
my-build-system/
├── src/
│   ├── index.js          # 入口
│   ├── components/
│   │   ├── App.js
│   │   └── Header.js
│   ├── utils/
│   │   ├── math.js
│   │   └── string.js
│   └── styles/
│       └── main.css
├── build/
│   ├── bundler.js        # 核心打包器
│   ├── hmr-server.js     # HMR 服务器
│   ├── tree-shaker.js    # Tree Shaking
│   └── analyzer.js       # Bundle 分析
├── dist/                 # 输出目录
├── package.json
└── build.config.js       # 构建配置
```

### 构建配置

```javascript
// build.config.js
module.exports = {
  entry: './src/index.js',
  output: {
    path: './dist',
    filename: 'bundle.js',
  },
  devServer: {
    port: 3000,
    hmr: true,
    open: true,
  },
  optimize: {
    treeShaking: true,
    minify: true,
    splitChunks: true,
  },
  analyze: true, // 生成 bundle 分析报告
};
```

### 一键构建脚本

```javascript
// build.js — 主构建脚本
const path = require('path');
const config = require('./build.config');
const { SimpleBundler } = require('./build/bundler');
const { TreeShaker } = require('./build/tree-shaker');
const { analyzeBundle } = require('./build/analyzer');

async function build() {
  console.log('🏗️  Starting build...\n');
  
  // Step 1: 打包
  const bundler = new SimpleBundler({
    entry: config.entry,
    output: path.join(config.output.path, config.output.filename),
  });
  bundler.build();
  
  // Step 2: Tree Shaking (可选)
  if (config.optimize.treeShaking) {
    const shaker = new TreeShaker();
    const shaken = shaker.shakeEntry(config.entry);
    console.log(`\n🌳 Tree Shaking: removed unused exports`);
  }
  
  // Step 3: Bundle 分析 (可选)
  if (config.analyze) {
    const bundlePath = path.join(config.output.path, config.output.filename);
    analyzeBundle(bundlePath);
  }
  
  console.log('\n✅ Build complete!');
}

async function dev() {
  console.log('🔥 Starting dev server...\n');
  
  // 启动 HMR 服务器
  const { HMRSserver } = require('./build/hmr-server');
  const server = new HMRSserver({
    root: './src',
    port: config.devServer.port,
  });
  server.start();
}

// 根据参数选择模式
const mode = process.argv[2] || 'build';
if (mode === 'dev') {
  dev();
} else {
  build();
}
```

---

## 📝 实战练习 (进阶版)

### 练习 1: Webpack 生产配置
创建一个支持以下功能的 Webpack 配置:
- [ ] React 18 + TypeScript 5
- [ ] CSS Modules + PostCSS + Autoprefixer
- [ ] 图片 WebP 转换 + 懒加载
- [ ] 路由级代码分割
- [ ] PWA 支持 (workbox)
- [ ] Bundle Analyzer 集成

### 练习 2: Vite 插件开发
编写一个 Vite 插件实现以下功能:
- [ ] 将 `.md` 文件转换为 React 组件
- [ ] 自动生成 SVG Sprite
- [ ] 环境变量注入 (`.env` 文件)

### 练习 3: 扩展手写 Bundler
为简易 Bundler 添加:
- [ ] CSS 文件处理 (提取为独立文件)
- [ ] Source Map 生成
- [ ] Tree Shaking 支持
- [ ] HMR 支持
- [ ] 插件系统 (类似 Webpack loader/plugin)

### 练习 4: 性能对比实验
对比 Webpack / Vite / esbuild 在同一项目上的表现:
- [ ] 冷启动时间
- [ ] HMR 更新速度
- [ ] 生产构建时间
- [ ] 产物大小
- [ ] 内存占用

---

## 📚 参考资源

- [Webpack 官方文档](https://webpack.js.org/)
- [Vite 官方文档](https://vitejs.dev/)
- [Rollup 官方文档](https://rollupjs.org/)
- [esbuild 官方文档](https://esbuild.github.io/)
- [Babel 官方文档](https://babeljs.io/)
- [深入理解 JavaScript 引擎 — V8](https://v8.dev/)
- [Module Federation 详解](https://webpack.js.org/concepts/module-federation/)

---

## 🎓 知识体系总结

### 构建工具知识图谱

```
构建工具
├── 核心概念
│   ├── 模块系统 (CommonJS / ESM / AMD / UMD)
│   ├── AST (抽象语法树)
│   ├── 依赖图 (Dependency Graph)
│   └── 代码生成 (Code Generation)
│
├── 开发体验
│   ├── HMR (热模块替换)
│   ├── Source Map
│   ├── DevServer
│   └── 错误Overlay
│
├── 生产优化
│   ├── Tree Shaking
│   ├── Code Splitting
│   ├── Minification
│   ├── Compression (gzip/brotli)
│   └── Cache Strategy
│
├── 工具链
│   ├── Webpack (配置驱动 / 生态最全)
│   ├── Vite (原生ESM / 极速开发)
│   ├── esbuild (Go编写 / 极致性能)
│   ├── Rollup (库打包 / ESM优先)
│   └── Turbopack (Rust编写 / 增量编译)
│
└── 手写实现
    ├── 模块解析 (import/require → AST)
    ├── 依赖图构建 (BFS/DFS 遍历)
    ├── 代码转换 (Babel / 正则)
    ├── 打包输出 (IIFE / 模块系统)
    ├── Tree Shaking (可达性分析)
    └── HMR (WebSocket + 模块替换)
```

---

*训练材料版本：2.0 | 最后更新：2026-04-26 14:00*
