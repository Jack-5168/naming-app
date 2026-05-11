# Web 性能优化 — Phase 2 构建优化：Vite 深度 + Tree Shaking + 包体积分析 (2026-05-06 05:00)

**前置基础：**
- Phase 1 (4/24-4/30): 懒加载/防抖节流/内存管理/虚拟列表/CRP/Web Vitals/SSR/Canvas/SW
- Phase 2 前篇 (5/02): Web Workers + WASM + 现代浏览器 API + 高级内存管理

**本次重点：** 构建层性能优化——从源码到产物的全链路优化，覆盖 Vite 深度配置、Tree Shaking 原理与陷阱、包体积分析与优化策略。

---

## 一、构建工具选型与性能对比

### 1.1 主流构建工具全景

```
┌─────────────────┬────────────┬────────────┬────────────┬────────────┐
│  特性            │  Webpack   │  Vite      │  esbuild   │  Rolldown  │
├─────────────────┼────────────┼────────────┼────────────┼────────────┤
│  核心语言         │  JS        │  JS+Go     │  Go        │  Rust      │
│  开发启动         │  5-30s     │  <100ms    │  <50ms     │  <100ms    │
│  HMR 速度         │  1-3s      │  <50ms     │  N/A       │  <50ms     │
│  生产构建         │  10-60s    │  5-30s     │  1-5s      │  3-15s     │
│  Tree Shaking    │  ✅        │  ✅ (Rollup)│  ⚠️ 部分    │  ✅        │
│  Code Splitting  │  ✅ 强大    │  ✅        │  ❌        │  ✅        │
│  生态成熟度       │  ⭐⭐⭐⭐⭐  │  ⭐⭐⭐⭐   │  ⭐⭐⭐     │  ⭐⭐       │
│  学习曲线         │  陡峭       │  平缓       │  平缓       │  平缓       │
└─────────────────┴────────────┴────────────┴────────────┴────────────┘

选型建议:
• 大型传统项目 (大量 loader/plugin) → Webpack 5
• 现代项目 (Vue/React/Svelte) → Vite (首选)
• 极速构建需求 → esbuild (开发) + Rolldown (生产)
• 库打包 → Vite (lib mode) / Rolldown
```

### 1.2 Vite 为什么快？—— 底层原理

```
Vite 开发模式快的原因:

┌─────────────────────────────────────────────────────────────┐
│  Webpack 开发模式 (传统)                                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │  从入口开始  │→│  递归打包    │→│  启动 dev   │         │
│  │  分析依赖    │  │  所有模块    │  │  服务器      │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
│  ⏱️ 所有模块打包完才能启动 → 5-30s                           │
│                                                              │
│  Vite 开发模式 (现代)                                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │  立即启动    │→│  浏览器请求  │→│  按需编译    │         │
│  │  dev server  │  │  哪个模块    │  │  ESM 原生    │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
│  ⏱️ 0 等待启动 → <100ms                                      │
│                                                              │
│  关键差异:                                                    │
│  1. 不需要预打包 (预构建仅针对依赖)                           │
│  2. 利用浏览器原生 ESM                                       │
│  3. esbuild 预构建依赖 (比 rollup 快 10-100x)               │
│  4. 热更新只编译变更模块                                      │
└─────────────────────────────────────────────────────────────┘
```

---

## 二、Vite 深度配置 — 生产级优化

### 2.1 开发环境优化

```javascript
// vite.config.js — 开发环境深度优化
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { visualizer } from 'rollup-plugin-visualizer';

export default defineConfig({
  plugins: [
    react({
      // React Fast Refresh 优化
      babel: {
        presets: [['@babel/preset-react', { runtime: 'automatic' }]],
        // 生产环境移除 propTypes
        plugins: [
          ['babel-plugin-react-remove-properties', { properties: ['propTypes'] }]
        ]
      }
    }),
  ],

  server: {
    // === 开发服务器优化 ===

    // 1. 端口 + 自动打开
    port: 3000,
    open: true,

    // 2. 热更新配置
    hmr: {
      // 自定义 HMR 端口 (解决代理问题)
      port: 3001,
      // 自定义 HMR 路径
      path: 'hmr/',
      // 覆盖主机
      overlay: true, // 错误覆盖层
    },

    // 3. 代理优化
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        // 重写路径
        rewrite: (path) => path.replace(/^\/api/, ''),
        // WebSocket 支持
        ws: true,
      },
    },

    // 4. 文件系统访问限制 (安全)
    fs: {
      allow: [
        // 只允许访问项目根目录
        path.resolve(__dirname),
      ],
    },

    // 5. 预构建配置
    /**
     * Vite 使用 esbuild 预构建依赖:
     * - CommonJS → ESM 转换
     * - 命名导出处理
     * - 依赖去重和扁平化
     * 
     * 预构建产物缓存在 node_modules/.vite/deps/
     */
    warmup: {
      // 预编译常用模块，首次访问更快
      clientFiles: [
        './src/components/Header.jsx',
        './src/components/Sidebar.jsx',
      ],
    },
  },

  // === 依赖预构建优化 ===
  optimizeDeps: {
    // 强制预构建指定依赖
    include: ['react', 'react-dom', 'react-router-dom'],

    // 排除不需要预构建的依赖
    exclude: ['my-local-package'],

    // 启用/禁用预构建
    disabled: false,

    // 强制重新预构建 (清除缓存)
    // force: true,

    // 自定义 esbuild 选项
    esbuildOptions: {
      // 目标环境
      target: 'es2020',
      // 格式
      format: 'esm',
    },
  },
});
```

### 2.2 生产构建优化

```javascript
// vite.config.js — 生产构建深度优化
import { defineConfig } from 'vite';
import { visualizer } from 'rollup-plugin-visualizer';
import compression from 'vite-plugin-compression';

export default defineConfig({
  build: {
    // === 基础构建配置 ===

    // 1. 目标环境
    target: 'es2020', // 不转译现代语法，减小体积

    // 2. 输出目录
    outDir: 'dist',

    // 3. 资源内联阈值 (bytes)
    // < 此值的资源会被内联为 base64
    // 设置过小 → 更多 HTTP 请求
    // 设置过大 → 单个 JS 文件过大
    assetsInlineLimit: 4096, // 4KB，平衡点

    // 4. CSS 代码分割
    cssCodeSplit: true, // 每个 JS 对应一个 CSS

    // 5. Sourcemap 策略
    // 'hidden' — 生产不暴露，但 Sentry 可用
    // 'inline' — sourcemap 内联到产物中
    // false — 完全不生成 (最快构建)
    sourcemap: 'hidden',

    // 6. 最小化
    minify: 'esbuild', // 'esbuild' (快) 或 'terser' (更小但慢)

    // 7. Terser 选项 (仅当 minify: 'terser')
    // terserOptions: {
    //   compress: {
    //     drop_console: true,    // 移除 console
    //     drop_debugger: true,   // 移除 debugger
    //     pure_funcs: ['console.log'], // 移除指定函数
    //   },
    // },

    // 8. 分块策略
    rollupOptions: {
      output: {
        // 手动分块
        manualChunks(id) {
          // 策略 1: 按 node_modules 分块
          if (id.includes('node_modules')) {
            // 大型库独立分块
            if (id.includes('echarts')) {
              return 'vendor-echarts';
            }
            if (id.includes('lodash-es')) {
              return 'vendor-lodash';
            }
            // 其他第三方库合并
            return 'vendor';
          }
          // 策略 2: 按路由分块
          if (id.includes('/src/pages/')) {
            const pageName = id.split('/src/pages/')[1].split('/')[0];
            return `page-${pageName}`;
          }
        },

        // 文件名模板
        chunkFileNames: 'js/[name]-[hash].js',
        entryFileNames: 'js/[name]-[hash].js',
        assetFileNames: (assetInfo) => {
          const name = assetInfo.name || '';
          if (/\.(png|jpe?g|gif|svg|webp|avif)$/i.test(name)) {
            return 'images/[name]-[hash][extname]';
          }
          if (/\.(woff2?|ttf|otf|eot)$/i.test(name)) {
            return 'fonts/[name]-[hash][extname]';
          }
          if (/\.css$/i.test(name)) {
            return 'css/[name]-[hash][extname]';
          }
          return 'assets/[name]-[hash][extname]';
        },
      },
    },

    // 9. 构建报告
    reportCompressedSize: true,
    // 警告阈值 (KB)
    chunkSizeWarningLimit: 500,

    // 10. 动态导入转为变量名
    dynamicImportVarsOptions: {
      warnOnError: true,
      exclude: [],
      include: [],
    },
  },

  plugins: [
    // === 生产优化插件 ===

    // 1. Gzip 压缩
    compression({
      algorithm: 'gzip',
      threshold: 10240, // > 10KB 才压缩
      deleteOriginFile: false,
    }),

    // 2. Brotli 压缩 (更好的压缩率)
    compression({
      algorithm: 'brotliCompress',
      ext: '.br',
      threshold: 10240,
    }),

    // 3. 可视化分析
    visualizer({
      open: false, // 构建完自动打开
      filename: 'dist/stats.html',
      gzipSize: true,
      brotliSize: true,
    }),
  ],
});
```

### 2.3 高级优化：自定义插件

```javascript
// === 插件 1: 自动图片优化 (Sharp) ===
// 构建时自动将图片转为 WebP/AVIF
import sharp from 'sharp';
import { readdir, readFile, writeFile, mkdir } from 'fs/promises';
import { join, extname, basename, dirname } from 'path';

function viteImageOptimize() {
  return {
    name: 'vite-image-optimize',
    async buildStart() {
      // 在构建开始前处理图片
      const imageDir = join(__dirname, 'src/assets/images');
      const outputDir = join(__dirname, 'public/optimized');

      await processImages(imageDir, outputDir);
    },
  };
}

async function processImages(inputDir, outputDir) {
  try {
    const files = await readdir(inputDir);
    const imageFiles = files.filter(f =>
      /\.(png|jpe?g|bmp)$/i.test(f)
    );

    for (const file of imageFiles) {
      const inputPath = join(inputDir, file);
      const baseName = basename(file, extname(file));

      // 生成 WebP
      await sharp(inputPath)
        .webp({ quality: 80, effort: 6 })
        .toFile(join(outputDir, `${baseName}.webp`));

      // 生成 AVIF
      await sharp(inputPath)
        .avif({ quality: 65, effort: 9 })
        .toFile(join(outputDir, `${baseName}.avif`));

      // 生成响应式尺寸
      for (const width of [320, 640, 960, 1280]) {
        await sharp(inputPath)
          .resize(width, null, { withoutEnlargement: true })
          .webp({ quality: 75 })
          .toFile(join(outputDir, `${baseName}-${width}.webp`));
      }
    }
  } catch (e) {
    // 图片目录不存在时跳过
  }
}

// === 插件 2: 分析构建时间 ===
function viteBuildTimer() {
  let startTime;

  return {
    name: 'vite-build-timer',
    buildStart() {
      startTime = performance.now();
      console.log('\n🔨 Build started...\n');
    },
    closeBundle() {
      const duration = ((performance.now() - startTime) / 1000).toFixed(2);
      console.log(`\n✅ Build completed in ${duration}s\n`);
    },
    transform(code, id) {
      const transformStart = performance.now();
      // 返回 null 表示不修改代码
      const duration = performance.now() - transformStart;
      if (duration > 100) {
        console.warn(`⚠️ Slow transform: ${id} (${duration.toFixed(0)}ms)`);
      }
      return null;
    },
  };
}

// === 插件 3: 环境变量注入优化 ===
function viteEnvOptimize() {
  return {
    name: 'vite-env-optimize',
    config(env, { mode }) {
      // 只注入 VITE_ 前缀的环境变量
      const allowedPrefix = 'VITE_';
      const envVars = {};

      for (const [key, value] of Object.entries(process.env)) {
        if (key.startsWith(allowedPrefix)) {
          envVars[key] = value;
        }
      }

      // 敏感变量检查
      const sensitiveKeys = ['SECRET', 'KEY', 'TOKEN', 'PASSWORD'];
      for (const [key] of Object.entries(process.env)) {
        if (sensitiveKeys.some(s => key.includes(s)) && !key.startsWith(allowedPrefix)) {
          console.warn(`⚠️ 敏感变量 ${key} 不会被注入到客户端`);
        }
      }

      return {
        define: {
          'process.env': JSON.stringify(envVars),
          __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
          __APP_VERSION__: JSON.stringify(process.env.npm_package_version || '0.0.0'),
        },
      };
    },
  };
}
```

---

## 三、Tree Shaking 深度解析 — 原理、陷阱与最佳实践

### 3.1 Tree Shaking 原理

```
Tree Shaking 工作原理:

┌─────────────────────────────────────────────────────────────┐
│                                                              │
│  1. 静态分析 (Static Analysis)                                │
│     ├── 解析 ES Module 的 import/export                       │
│     ├── 构建依赖图 (Dependency Graph)                         │
│     └── 标记被使用的导出 (used-exports)                       │
│                                                              │
│  2. 死代码消除 (Dead Code Elimination)                        │
│     ├── 移除未被标记的导出                                    │
│     ├── 移除不可达代码                                        │
│     └── 移除无副作用的纯函数调用                              │
│                                                              │
│  3. 最小化 (Minification)                                    │
│     ├── 变量名缩短 (a, b, c...)                               │
│     ├── 移除空格/注释                                        │
│     └── 代码优化 (常量折叠/条件简化)                          │
│                                                              │
│  前提条件:                                                    │
│  ✅ ES Module (import/export) — CJS 不支持                   │
│  ✅ production mode — 开发模式不做 tree shaking              │
│  ✅ sideEffects 标记 — 告诉打包工具哪些文件有副作用           │
│  ✅ 纯函数 — 无副作用的代码才能安全移除                       │
│                                                              │
│  不支持的情况:                                                │
│  ❌ 动态 import (import(x)) — 无法静态分析                   │
│  ❌ 条件导出 (if (x) export ...) — 运行时决定                │
│  ❌ 有副作用的模块 — 即使未使用也不能移除                     │
│  ❌ 修改全局对象的代码                                        │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 Tree Shaking 实战 — 什么能摇掉，什么不能

```javascript
// === 示例 1: 能 Tree Shaking 的代码 ===

// math.js — 纯函数模块
export function add(a, b) {
  return a + b;
}

export function subtract(a, b) {
  return a - b;
}

export function multiply(a, b) {
  return a * b;
}

// app.js
import { add } from './math.js';
// ✅ Tree Shaking 后: subtract 和 multiply 被移除
// ✅ 产物只包含 add 函数

// === 示例 2: 不能 Tree Shaking 的代码 ===

// bad-module.js — 有副作用
console.log('模块被加载了'); // ❌ 副作用：模块加载时执行

export const config = {
  version: '1.0.0',
};

// 修改全局对象
window.myGlobal = 'value'; // ❌ 副作用：修改全局

// app.js
import { config } from './bad-module.js';
// ❌ 整个模块被保留，因为副作用无法确定是否安全移除

// === 示例 3: 动态导入阻止 Tree Shaking ===

// utils.js
export function formatCurrency(num) { /* ... */ }
export function formatDate(date) { /* ... */ }
export function formatPhone(num) { /* ... */ }

// app.js
// ❌ 动态导入无法静态分析
const moduleName = 'utils';
const utils = await import(`./${moduleName}.js`);
// ❌ 整个 utils.js 被保留

// ✅ 静态导入允许 Tree Shaking
import { formatCurrency } from './utils.js';
// ✅ 只有 formatCurrency 被保留

// === 示例 4: 命名空间导入阻止 Tree Shaking ===

// lodash.js (假设)
export function debounce() { /* ... */ }
export function throttle() { /* ... */ }
export function cloneDeep() { /* ... */ }
// ... 数百个函数

// ❌ 命名空间导入
import * as _ from 'lodash-es';
_.debounce(fn, 300);
// ❌ 整个 lodash-es 被保留 (因为 _.debounce 无法静态确定)

// ✅ 命名导入
import { debounce } from 'lodash-es';
debounce(fn, 300);
// ✅ 只有 debounce 被保留

// ✅ 更好的方式: 直接导入子模块
import debounce from 'lodash-es/debounce';
// ✅ 只加载 debounce 模块

// === 示例 5: 条件导出 ===

// config.js
export const DEV_CONFIG = { debug: true };
export const PROD_CONFIG = { debug: false };

// 条件导出 — 运行时决定
if (process.env.NODE_ENV === 'production') {
  export { PROD_CONFIG as config };
} else {
  export { DEV_CONFIG as config };
}
// ❌ 条件导出无法静态分析，两个都被保留

// ✅ 正确做法: 使用构建工具的环境替换
// config.js
export const config = {
  debug: import.meta.env.DEV,
};
// ✅ 构建时 import.meta.env.DEV 被替换为 true/false
// ✅ 死代码消除后只保留一个分支
```

### 3.3 sideEffects 标记 — 告诉打包工具你的代码是安全的

```json
// package.json — 库作者必须配置
{
  "name": "my-utils",
  "version": "1.0.0",
  "type": "module",
  "main": "dist/index.cjs",
  "module": "dist/index.js",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "require": "./dist/index.cjs"
    }
  },
  // === 关键配置 ===
  "sideEffects": false
  // 或指定有副作用的文件
  // "sideEffects": [
  //   "*.css",
  //   "*.scss",
  //   "src/polyfills.js",
  //   "src/global-styles.js"
  // ]
}
```

```javascript
// === sideEffects: false 的含义 ===
//
// 当 sideEffects: false 时，打包工具假设:
// 1. 模块导入不会执行任何代码 (无副作用)
// 2. 未使用的导出可以安全移除
// 3. 整个未使用的模块可以被移除
//
// 副作用的例子:
// • console.log() / alert()
// • 修改全局变量 (window.xxx = ...)
// • polyfill (如 core-js)
// • CSS 导入 (import './style.css')
// • 注册全局事件监听器
// • 注册自定义元素 (customElements.define)

// === 正确标记副作用 ===

// ✅ 有 CSS 副作用
// sideEffects: ["*.css"]

// ✅ 有 polyfill 副作用
// sideEffects: ["src/polyfills.js", "*.css"]

// ✅ 无副作用 (纯函数库)
// sideEffects: false

// === 库作者 Checklist ===
//
// 1. 使用 ES Module (import/export)
// 2. 设置 sideEffects
// 3. 提供 "module" 入口 (ESM) 和 "main" 入口 (CJS)
// 4. 使用 "exports" 字段 (Node.js 12+)
// 5. 避免在模块顶层执行代码
// 6. 避免修改全局对象
// 7. 避免动态 require/import
```

### 3.4 常见 Tree Shaking 陷阱

```javascript
// === 陷阱 1: 默认导出 vs 命名导出 ===

// ❌ 默认导出 — Tree Shaking 效果差
// utils.js
export default {
  debounce,
  throttle,
  cloneDeep,
  // ... 更多函数
};

// app.js
import utils from './utils.js';
utils.debounce(fn, 300);
// ❌ 整个 default 对象被保留

// ✅ 命名导出 — Tree Shaking 效果好
// utils.js
export function debounce(fn, delay) { /* ... */ }
export function throttle(fn, delay) { /* ... */ }
export function cloneDeep(obj) { /* ... */ }

// app.js
import { debounce } from './utils.js';
// ✅ 只有 debounce 被保留

// === 陷阱 2: Barrel Files (索引文件) ===

// ❌ Barrel File 可能阻止 Tree Shaking
// index.js (barrel file)
export { debounce } from './debounce.js';
export { throttle } from './throttle.js';
export { cloneDeep } from './clone-deep.js';

// app.js
import { debounce } from './index.js';
// ⚠️ 某些打包工具无法追踪 barrel file 的 Tree Shaking
// 整个 barrel file 被保留 → 所有子模块也被保留

// ✅ 解决方案 1: 直接导入
import { debounce } from './debounce.js';

// ✅ 解决方案 2: 使用 reExportHelpers (Webpack 5+)
// ✅ 解决方案 3: 在 barrel file 中设置 sideEffects

// === 陷阱 3: 高阶函数包裹 ===

// ❌ HOF 可能阻止 Tree Shaking
// withLogging.js
export function withLogging(fn) {
  return function (...args) {
    console.log('Calling:', fn.name);
    return fn(...args);
  };
}

// utils.js
import { withLogging } from './withLogging.js';

export const fetchData = withLogging(async function fetchData() {
  // ...
});

export const processData = withLogging(async function processData() {
  // ...
});

// app.js
import { fetchData } from './utils.js';
// ⚠️ processData 可能无法被 Tree Shaking
// 因为 withLogging 的副作用不确定

// ✅ 解决方案: 确保 HOF 是纯函数
// withLogging.js
// @__PURE__ 注释告诉打包工具这是纯函数
export const withLogging = /*#__PURE__*/ function (fn) {
  return function (...args) {
    console.log('Calling:', fn.name);
    return fn(...args);
  };
};

// === 陷阱 4: 大型库的按需导入 ===

// ❌ 全量导入
import lodash from 'lodash'; // 70KB+

// ✅ Tree Shaking 导入 (需要 lodash-es)
import { debounce, throttle } from 'lodash-es'; // ~5KB

// ✅ 直接子模块导入 (最可靠)
import debounce from 'lodash-es/debounce';
import throttle from 'lodash-es/throttle'; // ~2KB

// ❌ Element Plus 全量导入
import ElementPlus from 'element-plus';
import 'element-plus/dist/index.css';

// ✅ Element Plus 按需导入
import { ElButton, ElInput } from 'element-plus';
// 配合 unplugin-vue-components 自动按需导入

// ❌ Ant Design 全量导入
import { Button, Input, Table } from 'antd';

// ✅ Ant Design 按需导入 (使用 babel-plugin-import 或 vite-plugin-implement)
// vite.config.js
import vitePluginImp from 'vite-plugin-imp';

export default {
  plugins: [
    vitePluginImp({
      libList: [
        {
          libName: 'antd',
          style: (name) => `antd/es/${name}/style/index.css`,
        },
      ],
    }),
  ],
};
```

### 3.5 Tree Shaking 验证工具

```javascript
// === 验证 Tree Shaking 是否生效 ===

// 方法 1: 查看构建产物
// 搜索未使用的导出名，如果出现在产物中 → Tree Shaking 失败

// 方法 2: 使用 webpack-bundle-analyzer / rollup-plugin-visualizer
// 查看模块大小，未使用的模块应该消失

// 方法 3: 自动化测试脚本
// verify-tree-shaking.js

import { build } from 'vite';
import { readFileSync } from 'fs';

async function verifyTreeShaking() {
  // 1. 构建
  await build({
    logLevel: 'silent',
  });

  // 2. 读取产物
  const distFiles = globSync('dist/assets/*.js');
  const content = distFiles
    .map(f => readFileSync(f, 'utf-8'))
    .join('\n');

  // 3. 检查未使用的导出是否出现
  const unusedExports = [
    'subtract',    // 只导入了 add
    'multiply',
    'throttle',    // 只导入了 debounce
  ];

  const failures = [];
  for (const exp of unusedExports) {
    if (content.includes(exp)) {
      failures.push(exp);
    }
  }

  if (failures.length > 0) {
    console.error('❌ Tree Shaking 失败，以下导出未被移除:');
    failures.forEach(f => console.error(`  - ${f}`));
    process.exit(1);
  } else {
    console.log('✅ Tree Shaking 验证通过');
  }
}

verifyTreeShaking();
```

---

## 四、包体积分析 — 找到每一个 KB 的去处

### 4.1 分析工具链

```
包体积分析工具链:

┌─────────────────────────────────────────────────────────────┐
│                                                              │
│  1. rollup-plugin-visualizer                                │
│     • 生成交互式 HTML 报告                                    │
│     • 显示 gzip/brotli 大小                                  │
│     • 支持 treemap / sunburst / network 视图                 │
│                                                              │
│  2. source-map-explorer                                     │
│     • 基于 sourcemap 分析原始代码大小                         │
│     • 识别哪些源码贡献最大                                    │
│     • npx source-map-explorer dist/assets/*.js              │
│                                                              │
│  3. webpack-bundle-analyzer                                 │
│     • Webpack 生态标准工具                                   │
│     • 交互式 treemap 可视化                                  │
│                                                              │
│  4. bundlephobia.com                                        │
│     • 在线查询任意 npm 包的大小                               │
│     • 显示 import vs require 大小差异                        │
│     • 显示依赖树                                             │
│                                                              │
│  5. pkg-size.dev                                            │
│     • 在线测试任意 import 的实际大小                          │
│     • 支持多包对比                                            │
│     • 显示 Tree Shaking 后的实际大小                         │
│                                                              │
│  6. depcheck                                                │
│     • 检测未使用的依赖                                        │
│     • npm install -g depcheck && depcheck                    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 Visualizer 配置与解读

```javascript
// vite.config.js — 完整 visualizer 配置
import { visualizer } from 'rollup-plugin-visualizer';

export default {
  plugins: [
    visualizer({
      // 输出文件
      filename: 'dist/stats.html',

      // 打开浏览器
      open: false,

      // gzip 大小
      gzipSize: true,

      // brotli 大小 (更准确)
      brotliSize: true,

      // 文件类型
      template: 'sunburst', // 'treemap' | 'sunburst' | 'network'

      // 项目根路径
      projectRoot: '.',

      // 过滤模块
      filter: (module) => {
        // 排除 node_modules 中的小文件
        if (module.id?.includes('node_modules')) {
          return module.size > 1000;
        }
        return true;
      },

      // 标题
      title: 'My App Bundle Analysis',
    }),
  ],
};

// === 如何解读 visualizer 报告 ===
//
// Treemap 视图:
// • 矩形面积 = 模块大小
// • 颜色 = 模块类型 (蓝色=业务代码, 绿色=第三方库)
// • 点击可深入查看子模块
//
// 关注重点:
// 1. 最大的矩形 — 哪个库/模块最大？
// 2. 重复的模块 — 是否有重复打包？
// 3. 未使用的模块 — 是否导入了但没用到？
// 4. 依赖树 — 是否有不必要的深层依赖？
//
// Sunburst 视图:
// • 中心 = 入口文件
// • 外圈 = 依赖层级
// • 弧长 = 模块大小
// • 适合查看依赖深度
//
// Network 视图:
// • 节点 = 模块
// • 连线 = 依赖关系
// • 适合查看模块间依赖
```

### 4.3 包体积优化策略

```javascript
// === 策略 1: 外部化大型依赖 (Externalize) ===
//
// 适用场景: CDN 已提供的大型库 (React, Vue, lodash)
// 原理: 不从 bundle 中打包，通过 CDN 引入

// vite.config.js
export default {
  build: {
    rollupOptions: {
      external: ['react', 'react-dom'],
      output: {
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM',
        },
      },
    },
  },
};

// index.html
// <script src="https://cdn.jsdelivr.net/npm/react@18/umd/react.production.min.js"></script>
// <script src="https://cdn.jsdelivr.net/npm/react-dom@18/umd/react-dom.production.min.js"></script>

// 效果: bundle 减少 ~130KB (React + ReactDOM)

// === 策略 2: 按需加载大型库 ===

// ❌ 全量导入 ECharts
import * as echarts from 'echarts';
const chart = echarts.init(el);
chart.setOption({ /* ... */ });

// ✅ 按需导入 ECharts
import * as echarts from 'echarts/core';
import { LineChart } from 'echarts/charts';
import {
  TitleComponent,
  TooltipComponent,
  GridComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';

echarts.use([
  LineChart,
  TitleComponent,
  TooltipComponent,
  GridComponent,
  CanvasRenderer,
]);

// 效果: 从 ~1MB 减少到 ~150KB

// === 策略 3: 替换大型依赖 ===

// 对比表:
// ┌─────────────────┬──────────────┬──────────────┬──────────────────┐
// │  功能            │  大型库       │  轻量替代     │  体积节省        │
// ├─────────────────┼──────────────┼──────────────┼──────────────────┤
// │  日期格式化       │  moment (330KB)│ date-fns (7KB)│ 98%             │
// │                  │              │ dayjs (2KB)  │ 99%              │
// ├─────────────────┼──────────────┼──────────────┼──────────────────┤
// │  工具函数         │  lodash (70KB)│ lodash-es (按需)│ 90%+         │
// │                  │              │ tinylibs     │ 95%+             │
// ├─────────────────┼──────────────┼──────────────┼──────────────────┤
// │  状态管理         │  redux (8KB) │  zustand (1KB)│ 87%             │
// │                  │              │  jotai (4KB) │ 50%              │
// ├─────────────────┼──────────────┼──────────────┼──────────────────┤
// │  表单验证         │  ajv (100KB) │  zod (40KB)  │ 60%              │
// │                  │              │  valibot (7KB)│ 93%             │
// ├─────────────────┼──────────────┼──────────────┼──────────────────┤
// │  HTTP 客户端      │  axios (13KB)│  ofetch (3KB)│ 77%              │
// │                  │              │  ky (6KB)    │ 54%              │
// ├─────────────────┼──────────────┼──────────────┼──────────────────┤
// │  图标库           │  fontawesome  │  unplugin-icons│ 按需加载     │
// │                  │  (500KB+)    │  (按需)       │ 99%              │
// └─────────────────┴──────────────┴──────────────┴──────────────────┘

// === 策略 4: 路由级代码分割 ===

// router.js
import { createRouter } from 'vue-router';

const routes = [
  {
    path: '/',
    component: () => import('./pages/Home.vue'), // 懒加载
  },
  {
    path: '/dashboard',
    component: () => import('./pages/Dashboard.vue'), // 懒加载
    // 预获取: 用户导航到该路由时提前加载
    meta: { prefetch: true },
  },
  {
    path: '/settings',
    component: () => import('./pages/Settings.vue'), // 懒加载
  },
  {
    path: '/admin',
    component: () => import('./pages/Admin.vue'), // 懒加载
    // 只在用户登录后才加载
    meta: { requiresAuth: true },
  },
];

// === 策略 5: 组件级懒加载 ===

// HeavyComponent.vue — 重型组件
// 使用 Suspense + lazy
import { defineAsyncComponent } from 'vue';

const HeavyChart = defineAsyncComponent(
  () => import('./components/HeavyChart.vue')
);

// 带加载状态和错误处理
const HeavyChart2 = defineAsyncComponent({
  loader: () => import('./components/HeavyChart.vue'),
  loadingComponent: LoadingSpinner,
  errorComponent: ErrorFallback,
  delay: 200,      // 延迟 200ms 再显示 loading
  timeout: 10000,  // 10s 超时
});

// === 策略 6: Intersection Observer 懒加载 ===

// 只在元素进入视口时才加载组件
function useLazyLoad(el, importFn) {
  const Component = ref(null);
  const observer = new IntersectionObserver(
    ([entry]) => {
      if (entry.isIntersecting) {
        importFn().then(mod => {
          Component.value = mod.default;
        });
        observer.disconnect();
      }
    },
    { rootMargin: '200px' }
  );

  watch(el, (newEl) => {
    if (newEl) observer.observe(newEl);
  });

  onUnmounted(() => observer.disconnect());

  return Component;
}

// === 策略 7: 预加载关键资源 ===

// vite.config.js — 预加载策略
export default {
  build: {
    rollupOptions: {
      output: {
        // 预加载入口 chunk 依赖的 chunk
        inlineDynamicImports: false,

        // 手动指定 preload/prefetch
        // preload: 当前页面需要的资源
        // prefetch: 未来页面可能需要的资源
      },
    },
  },
};

// index.html
// 预加载关键 CSS
// <link rel="preload" href="/styles/critical.css" as="style">
// 预加载字体
// <link rel="preload" href="/fonts/main.woff2" as="font" crossorigin>
// 预获取下一个页面
// <link rel="prefetch" href="/js/page-dashboard.js">
```

### 4.4 包体积预算 (Bundle Budget)

```javascript
// === 包体积预算配置 ===
// 在 CI 中自动检查包体积是否超标

// budget.config.js
const BUDGET = {
  // 初始加载预算
  initial: {
    js: 170 * 1024,     // 170KB (gzip) — 对应 ~3s 加载时间 (3G)
    css: 50 * 1024,     // 50KB (gzip)
    total: 250 * 1024,  // 250KB (gzip)
  },

  // 单个 chunk 预算
  chunk: {
    js: 100 * 1024,     // 100KB
    css: 30 * 1024,     // 30KB
  },

  // 第三方库预算
  vendor: {
    max: 300 * 1024,    // 300KB
  },

  // 图片预算
  images: {
    perImage: 100 * 1024, // 单张图片 < 100KB
    total: 500 * 1024,    // 总图片 < 500KB
  },
};

// 检查脚本: check-budget.js
import { readdir, stat } from 'fs/promises';
import { join } from 'path';
import zlib from 'zlib';
import { promisify } from 'util';

const gzip = promisify(zlib.gzip);

async function checkBudget() {
  const distDir = './dist/assets';
  const files = await readdir(distDir);

  let totalJs = 0;
  let totalCss = 0;
  let violations = [];

  for (const file of files) {
    const filePath = join(distDir, file);
    const content = await import('fs/promises').then(fs =>
      fs.readFile(filePath)
    );

    const gzipped = await gzip(content);
    const size = gzipped.length;

    if (file.endsWith('.js')) {
      totalJs += size;
      if (size > BUDGET.chunk.js) {
        violations.push(`JS chunk ${file} 超标: ${(size / 1024).toFixed(0)}KB > ${(BUDGET.chunk.js / 1024).toFixed(0)}KB`);
      }
    } else if (file.endsWith('.css')) {
      totalCss += size;
      if (size > BUDGET.chunk.css) {
        violations.push(`CSS chunk ${file} 超标: ${(size / 1024).toFixed(0)}KB > ${(BUDGET.chunk.css / 1024).toFixed(0)}KB`);
      }
    }
  }

  if (totalJs > BUDGET.initial.js) {
    violations.push(`总 JS 超标: ${(totalJs / 1024).toFixed(0)}KB > ${(BUDGET.initial.js / 1024).toFixed(0)}KB`);
  }

  if (totalCss > BUDGET.initial.css) {
    violations.push(`总 CSS 超标: ${(totalCss / 1024).toFixed(0)}KB > ${(BUDGET.initial.css / 1024).toFixed(0)}KB`);
  }

  if (violations.length > 0) {
    console.error('\n❌ 包体积预算检查失败:\n');
    violations.forEach(v => console.error(`  ${v}`));
    process.exit(1);
  } else {
    console.log('\n✅ 包体积预算检查通过');
    console.log(`  JS: ${(totalJs / 1024).toFixed(0)}KB / ${(BUDGET.initial.js / 1024).toFixed(0)}KB`);
    console.log(`  CSS: ${(totalCss / 1024).toFixed(0)}KB / ${(BUDGET.initial.css / 1024).toFixed(0)}KB`);
  }
}

checkBudget();
```

---

## 五、综合实战：从零优化一个真实项目

### 5.1 项目现状诊断

```
假设项目: 企业级管理后台 (Vue 3 + Vite)

优化前诊断:
┌─────────────────────────────────────────────────────────────┐
│                                                              │
│  初始加载:                                                    │
│  • 首屏 JS: 1.2MB (未压缩) → 380KB (gzip)                   │
│  • 首屏 CSS: 200KB (未压缩) → 45KB (gzip)                   │
│  • 首屏加载时间: 4.5s (3G 网络)                               │
│  • LCP: 5.2s (目标 < 2.5s) ❌                               │
│  • INP: 350ms (目标 < 200ms) ❌                              │
│                                                              │
│  问题分析:                                                    │
│  1. echarts 全量导入: 980KB → 150KB (可优化)                 │
│  2. moment.js 全量: 330KB → 2KB (dayjs 替代)                │
│  3. 未使用代码分割: 所有页面打包在一起                        │
│  4. 图片未优化: PNG 格式，未压缩                              │
│  5. 字体全量加载: 未子集化                                    │
│  6. 无 Service Worker: 每次全量加载                           │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 5.2 优化方案实施

```javascript
// === vite.config.js — 优化后完整配置 ===
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import vueJsx from '@vitejs/plugin-vue-jsx';
import { visualizer } from 'rollup-plugin-visualizer';
import compression from 'vite-plugin-compression';
import vitePluginImp from 'vite-plugin-imp';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    vue(),
    vueJsx(),

    // 按需导入 Element Plus
    vitePluginImp({
      libList: [
        {
          libName: 'element-plus',
          style: (name) => `element-plus/es/${name}/style/index.css`,
        },
      ],
    }),

    // Gzip + Brotli 压缩
    compression({
      algorithm: 'gzip',
      threshold: 10240,
    }),
    compression({
      algorithm: 'brotliCompress',
      ext: '.br',
      threshold: 10240,
    }),

    // PWA (Service Worker)
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        // 预缓存关键资源
        globPatterns: [
          '**/*.{js,css,html,svg,png,webp}',
        ],
        // 最大缓存大小
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        // 运行时缓存策略
        runtimeCaching: [
          {
            // API 请求 — Network First
            urlPattern: /^\/api\//,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 5 * 60, // 5 分钟
              },
            },
          },
          {
            // 图片 — Cache First
            urlPattern: /\.(png|jpe?g|webp|svg)/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'image-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 30 * 24 * 60 * 60, // 30 天
              },
            },
          },
        ],
      },
    }),

    // 可视化分析
    visualizer({
      filename: 'dist/stats.html',
      gzipSize: true,
      brotliSize: true,
      template: 'sunburst',
    }),
  ],

  build: {
    target: 'es2020',
    minify: 'esbuild',
    sourcemap: 'hidden',
    cssCodeSplit: true,
    assetsInlineLimit: 4096,
    chunkSizeWarningLimit: 300,

    rollupOptions: {
      output: {
        manualChunks: {
          // Vue 核心
          'vue-vendor': ['vue', 'vue-router', 'pinia'],
          // Element Plus (按需导入后仍然较大)
          'element-plus': ['element-plus'],
          // ECharts (按需导入后)
          'echarts': ['echarts'],
        },

        chunkFileNames: 'js/[name]-[hash].js',
        entryFileNames: 'js/[name]-[hash].js',
        assetFileNames: (assetInfo) => {
          const name = assetInfo.name || '';
          if (/\.(png|jpe?g|gif|svg|webp)$/i.test(name)) {
            return 'images/[name]-[hash][extname]';
          }
          if (/\.(woff2?|ttf)$/i.test(name)) {
            return 'fonts/[name]-[hash][extname]';
          }
          if (/\.css$/i.test(name)) {
            return 'css/[name]-[hash][extname]';
          }
          return 'assets/[name]-[hash][extname]';
        },
      },
    },
  },

  optimizeDeps: {
    include: [
      'vue',
      'vue-router',
      'pinia',
      'element-plus',
    ],
  },
});
```

### 5.3 优化效果对比

```
优化前 vs 优化后:

┌─────────────────────────┬────────────┬────────────┬──────────┐
│  指标                    │  优化前     │  优化后     │  改善     │
├─────────────────────────┼────────────┼────────────┼──────────┤
│  首屏 JS (gzip)          │  380KB     │  125KB     │  -67%    │
│  首屏 CSS (gzip)         │  45KB      │  18KB      │  -60%    │
│  总初始加载 (gzip)       │  425KB     │  143KB     │  -66%    │
│  首屏加载时间 (3G)       │  4.5s      │  1.8s      │  -60%    │
│  LCP                     │  5.2s      │  1.9s      │  ✅      │
│  INP                     │  350ms     │  85ms      │  ✅      │
│  CLS                     │  0.15      │  0.02      │  ✅      │
│  构建时间                │  45s       │  18s       │  -60%    │
│  HMR 速度                │  2s        │  35ms      │  -98%    │
│  二次加载 (SW 缓存)      │  425KB     │  12KB      │  -97%    │
├─────────────────────────┼────────────┼────────────┼──────────┤
│  关键优化措施:            │                                            │
│  • echarts 按需导入       │  980KB → 150KB                            │
│  • moment → dayjs         │  330KB → 2KB                              │
│  • 路由级代码分割         │  单文件 → 8 个 chunk                      │
│  • 图片 WebP 转换         │  PNG → WebP (-60%)                        │
│  • Service Worker         │  二次加载 -97%                            │
│  • Gzip + Brotli          │  额外 -30%                                │
│  • Vite 预构建            │  开发启动 -95%                            │
└─────────────────────────┴────────────┴────────────┴──────────┘
```

---

## 六、性能优化 Checklist (完整版)

### 6.1 构建阶段 Checklist

```
□ 使用 Vite (而非 Webpack，除非有特殊需求)
□ target 设置为 es2020 (不转译现代语法)
□ minify 使用 esbuild (而非 terser)
□ 启用 CSS 代码分割
□ 配置 manualChunks 手动分块
□ 第三方库独立分块 (vendor chunk)
□ 路由级代码分割 (动态 import)
□ 组件级懒加载 (defineAsyncComponent / React.lazy)
□ 启用 Gzip 压缩
□ 启用 Brotli 压缩
□ 设置 assetsInlineLimit (4KB)
□ 配置 sourcemap: 'hidden'
□ 设置 chunkSizeWarningLimit
□ 预构建常用依赖 (optimizeDeps.include)
□ 配置 HMR 端口 (解决代理问题)
```

### 6.2 Tree Shaking Checklist

```
□ 使用 ES Module (import/export)
□ 避免命名空间导入 (import * as)
□ 避免默认导出大型对象
□ 避免 Barrel Files (或配置 sideEffects)
□ 使用 lodash-es 而非 lodash
□ 大型库按需导入 (echarts/antd/element-plus)
□ 库的 package.json 设置 sideEffects
□ 避免在模块顶层执行副作用代码
□ 避免动态 import (import(x))
□ 使用 pkg-size.dev 验证实际导入大小
```

### 6.3 包体积 Checklist

```
□ 使用 visualizer 分析产物
□ 识别最大的 5 个模块
□ 替换大型依赖 (moment→dayjs, lodash→tinylibs)
□ 图片转 WebP/AVIF
□ 字体子集化
□ 移除未使用的依赖 (depcheck)
□ 设置包体积预算
□ CI 中自动检查预算
□ 使用 CDN 外部化大型库 (可选)
□ 二次加载使用 Service Worker 缓存
```

### 6.4 运行时 Checklist

```
□ 图片懒加载 (loading="lazy" / IntersectionObserver)
□ 防抖/节流高频事件
□ 虚拟列表 (大列表场景)
□ 避免布局抖动 (读写分离)
□ 使用 transform 替代 top/left
□ 使用 requestAnimationFrame
□ 组件卸载时清理资源
□ 使用 WeakMap 缓存
□ Web Worker 处理计算密集型任务
□ 监控 Web Vitals (LCP/INP/CLS)
```

---

## 七、闭卷自测题

### 题 1: Tree Shaking 判断

```javascript
// 以下哪些写法支持 Tree Shaking？

// A. import * as _ from 'lodash-es';
// B. import { debounce } from 'lodash-es';
// C. import debounce from 'lodash-es/debounce';
// D. const _ = require('lodash');
// E. import defaultExport from './utils.js'; (utils.js 有默认导出对象)

// 答案: B, C
// A: 命名空间导入，无法确定使用了哪些属性
// D: CommonJS，不支持 Tree Shaking
// E: 默认导出对象，整个对象被保留
```

### 题 2: Vite 构建优化

```javascript
// 以下 Vite 配置中，哪个设置对减小产物体积最有效？

// A. build.minify: 'terser'
// B. build.rollupOptions.output.manualChunks
// C. build.target: 'es2020'
// D. optimizeDeps.include: ['react']
// E. build.cssCodeSplit: true

// 答案: B (manualChunks)
// 分析:
// A: terser 比 esbuild 小 5-10%，但构建慢 5x
// B: 合理分块可避免重复打包，减少 20-40%
// C: 减少转译代码量，减少 10-20%
// D: 不影响产物体积，只影响开发体验
// E: 不影响总体积，只影响 CSS 组织方式
```

### 题 3: 包体积优化排序

```
// 一个项目的产物分析显示:
// • echarts: 980KB (全量导入)
// • moment: 330KB (全量导入)
// • lodash: 70KB (全量导入)
// • 业务代码: 200KB
// • 未使用代码: 150KB
//
// 按"投入产出比"排序优化措施:
//
// 1. moment → dayjs (330KB → 2KB, 节省 328KB, 工作量 1h)
// 2. echarts 按需导入 (980KB → 150KB, 节省 830KB, 工作量 2h)
// 3. lodash → lodash-es 按需 (70KB → 5KB, 节省 65KB, 工作量 1h)
// 4. 移除未使用代码 (150KB → 0, 节省 150KB, 工作量 4h)
// 5. 业务代码优化 (200KB → 150KB, 节省 50KB, 工作量 8h)
//
// 投入产出比 = 节省大小 / 工作量
// 1. 328KB/h (最高)
// 2. 415KB/h
// 3. 65KB/h
// 4. 37.5KB/h
// 5. 6.25KB/h (最低)
```

---

## 八、总结

### 本次训练产出

| 模块 | 内容 | 代码量 |
|------|------|--------|
| 构建工具选型 | Webpack/Vite/esbuild/Rolldown 对比 | ~50 行 |
| Vite 开发优化 | HMR/代理/预构建/warmup 配置 | ~100 行 |
| Vite 生产优化 | manualChunks/压缩/sourcemap/插件 | ~150 行 |
| 自定义插件 | 图片优化/构建计时/环境变量注入 | ~120 行 |
| Tree Shaking 原理 | 静态分析/死代码消除/前提条件 | ~80 行 |
| Tree Shaking 实战 | 能/不能摇掉的代码示例 | ~150 行 |
| Tree Shaking 陷阱 | 默认导出/barrel/HOF/大型库 | ~120 行 |
| 包体积分析 | visualizer/策略/预算 | ~150 行 |
| 综合实战 | 真实项目优化 (1.2MB → 143KB) | ~100 行 |
| Checklist + 自测 | 4 张完整清单 + 3 道闭卷题 | ~100 行 |

### 性能优化完整知识体系 (更新)

```
性能优化
├── Phase 1: 主线程优化 (4/24-4/30)
│   ├── 基础层: 懒加载/防抖节流/内存管理/虚拟列表
│   ├── 进阶层: CRP/Web Vitals/重排优化/网络层
│   ├── 综合实战: 高性能数据看板
│   ├── 扩展场景: SSR/Canvas/SW/图片优化
│   └── 生产级: Toolkit/审计框架/端到端优化
├── Phase 2 前篇: 主线程外优化 (5/02)
│   ├── Web Workers (WorkerPool/Transferable)
│   ├── WebAssembly (AssemblyScript/零拷贝)
│   ├── 现代浏览器 API (postTask/OffscreenCanvas/CompressionStream)
│   └── 高级内存管理 (WeakRef/对象池/泄漏检测)
└── Phase 2 本篇: 构建层优化 (5/06 本次)
    ├── 构建工具选型与原理
    ├── Vite 深度配置 (开发/生产/插件)
    ├── Tree Shaking 原理与陷阱
    ├── 包体积分析与优化策略
    └── 真实项目优化实战 (1.2MB → 143KB)
```

### 累计性能优化训练 (9 次)

| 日期 | 主题 | 核心产出 |
|------|------|----------|
| 4/24 | 基础版 | 懒加载/防抖节流/内存管理/虚拟列表 |
| 4/25 | 进阶版 | CRP/Web Vitals/重排优化/网络层 |
| 4/26 | 综合实战 | 高性能数据看板 |
| 4/27 | 查漏补缺 | SSR/Canvas/SW 扩展 |
| 4/28 | 生产级 Toolkit | 八大模块可复用库 |
| 4/29 | 实战模式 | 真实场景 + 反模式 |
| 4/30 | Phase 1 终章 | 性能审计框架 + 端到端优化 |
| 5/02 | Phase 2 进阶 | Worker + WASM + 现代 API + 高级内存 |
| **5/06** | **构建优化** | **Vite 深度 + Tree Shaking + 包体积分析** |

---

_下次训练预告: Phase 2 继续 — CDN 策略 + 边缘计算 + 全球化性能优化_
