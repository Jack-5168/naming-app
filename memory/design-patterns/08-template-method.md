# 模板方法模式 (Template Method Pattern)

## 核心思想
在父类中定义一个算法的骨架（模板方法），将某些步骤延迟到子类实现。子类可以不改变算法结构的情况下重定义某些步骤。

## 适用场景
- 数据处理流水线（读取 → 解析 → 验证 → 转换 → 存储）
- 测试框架（setup → execute → teardown）
- 构建工具（lint → compile → bundle → minify → deploy）
- 游戏 AI 行为（感知 → 决策 → 执行）

## JS 原生体现
- Koa 中间件 compose — 骨架固定，中间件自定义
- Express 路由处理 — `app.get(path, handler)` 骨架相同，handler 不同
- `Array.prototype.sort` — 排序骨架固定，比较函数自定义

## 与策略模式的区别
| 维度 | 模板方法 | 策略模式 |
|------|----------|----------|
| 关系 | 继承（父类→子类） | 组合（上下文→策略） |
| 控制 | 父类控制算法骨架 | 客户端选择算法 |
| 粒度 | 部分步骤可变 | 整个算法可替换 |

---

## 实现一：数据处理流水线

```javascript
// ============ 场景：不同格式的数据导入 ============

// --- 抽象基类：定义处理骨架 ---
class DataImporter {
  // 模板方法：定义算法骨架（final，子类不应覆盖）
  import(source) {
    console.log(`\n=== 开始导入: ${this.getFormatName()} ===`);

    // 步骤 1: 读取数据（抽象方法，子类实现）
    const rawData = this.read(source);
    console.log(`  [1/5] 读取数据: ${rawData.length} 条`);

    // 步骤 2: 解析数据（抽象方法，子类实现）
    const parsed = this.parse(rawData);
    console.log(`  [2/5] 解析完成: ${parsed.length} 条`);

    // 步骤 3: 验证数据（抽象方法，子类实现）
    const validated = this.validate(parsed);
    console.log(`  [3/5] 验证通过: ${validated.length} 条`);

    // 步骤 4: 转换数据（抽象方法，子类实现）
    const transformed = this.transform(validated);
    console.log(`  [4/5] 转换完成: ${transformed.length} 条`);

    // 步骤 5: 存储数据（抽象方法，子类实现）
    const result = this.store(transformed);
    console.log(`  [5/5] 存储完成: ${result}`);

    console.log(`=== 导入完成: ${this.getFormatName()} ===`);
    return result;
  }

  // 抽象方法（子类必须实现）
  getFormatName() { throw new Error('子类必须实现 getFormatName'); }
  read(source) { throw new Error('子类必须实现 read'); }
  parse(data) { throw new Error('子类必须实现 parse'); }
  validate(data) { throw new Error('子类必须实现 validate'); }
  transform(data) { throw new Error('子类必须实现 transform'); }
  store(data) { throw new Error('子类必须实现 store'); }

  // 钩子方法（子类可选择覆盖）
  onImportStart() { /* 默认空操作 */ }
  onImportEnd(result) { /* 默认空操作 */ }
}

// ============ CSV 导入器 ============

class CSVImporter extends DataImporter {
  getFormatName() { return 'CSV'; }

  read(source) {
    // 模拟读取 CSV 文件
    console.log(`    [CSV] 读取文件: ${source}`);
    return [
      'name,age,email,role',
      'Alice,25,alice@example.com,admin',
      'Bob,30,bob@example.com,user',
      'Charlie,28,charlie@example.com,user'
    ];
  }

  parse(lines) {
    const headers = lines[0].split(',');
    return lines.slice(1).map(line => {
      const values = line.split(',');
      return headers.reduce((obj, h, i) => {
        obj[h] = values[i];
        return obj;
      }, {});
    });
  }

  validate(data) {
    return data.filter(row => {
      const valid = row.name && row.email && row.email.includes('@');
      if (!valid) console.log(`    [CSV] 跳过无效行: ${JSON.stringify(row)}`);
      return valid;
    });
  }

  transform(data) {
    return data.map(row => ({
      ...row,
      age: parseInt(row.age, 10),
      role: row.role || 'user',
      createdAt: new Date().toISOString()
    }));
  }

  store(data) {
    console.log(`    [CSV] 写入数据库, 共 ${data.length} 条`);
    return `${data.length} records imported`;
  }
}

// ============ JSON 导入器 ============

class JSONImporter extends DataImporter {
  getFormatName() { return 'JSON'; }

  read(source) {
    console.log(`    [JSON] 读取文件: ${source}`);
    return JSON.stringify([
      { name: 'Alice', age: 25, email: 'alice@example.com', role: 'admin' },
      { name: 'Bob', age: 30, email: 'bob@example.com' },
      { name: 'Charlie', age: 28, email: 'charlie@example.com', role: 'user' }
    ]);
  }

  parse(raw) {
    return JSON.parse(raw);
  }

  validate(data) {
    return data.filter(row => {
      const valid = row.name && row.email && row.email.includes('@');
      if (!valid) console.log(`    [JSON] 跳过无效行: ${JSON.stringify(row)}`);
      return valid;
    });
  }

  transform(data) {
    return data.map(row => ({
      ...row,
      age: parseInt(row.age, 10),
      role: row.role || 'user',
      createdAt: new Date().toISOString()
    }));
  }

  store(data) {
    console.log(`    [JSON] 写入数据库, 共 ${data.length} 条`);
    return `${data.length} records imported`;
  }
}

// ============ XML 导入器 ============

class XMLImporter extends DataImporter {
  getFormatName() { return 'XML'; }

  read(source) {
    console.log(`    [XML] 读取文件: ${source}`);
    return `
      <users>
        <user><name>Alice</name><age>25</age><email>alice@example.com</email><role>admin</role></user>
        <user><name>Bob</name><age>30</age><email>bob@example.com</email><role>user</role></user>
      </users>`;
  }

  parse(raw) {
    // 简易 XML 解析
    const userRegex = /<user>(.*?)<\/user>/gs;
    const users = [];
    let match;
    while ((match = userRegex.exec(raw)) !== null) {
      const userData = {};
      const tagRegex = /<(\w+)>([^<]+)<\/\w+>/g;
      let tagMatch;
      while ((tagMatch = tagRegex.exec(match[1])) !== null) {
        userData[tagMatch[1]] = tagMatch[2];
      }
      users.push(userData);
    }
    return users;
  }

  validate(data) {
    return data.filter(row => row.name && row.email && row.email.includes('@'));
  }

  transform(data) {
    return data.map(row => ({
      ...row,
      age: parseInt(row.age, 10),
      role: row.role || 'user',
      createdAt: new Date().toISOString()
    }));
  }

  store(data) {
    console.log(`    [XML] 写入数据库, 共 ${data.length} 条`);
    return `${data.length} records imported`;
  }
}

// ============ 使用 ============

const csvImporter = new CSVImporter();
csvImporter.import('users.csv');

const jsonImporter = new JSONImporter();
jsonImporter.import('users.json');

const xmlImporter = new XMLImporter();
xmlImporter.import('users.xml');
```

## 实现二：测试框架

```javascript
// ============ 场景：测试框架骨架 ============

class TestRunner {
  // 模板方法：测试执行骨架
  run(testName, testCases) {
    console.log(`\n╔══════════════════════════════════╗`);
    console.log(`║  ${testName.padEnd(34)}║`);
    console.log(`╚══════════════════════════════════╝`);

    let passed = 0;
    let failed = 0;

    // 测试前钩子
    this.beforeAll();

    for (let i = 0; i < testCases.length; i++) {
      const testCase = testCases[i];

      // 每个测试用例前
      this.beforeEach(testCase);

      try {
        // 执行测试（抽象方法）
        this.executeTest(testCase);
        passed++;
        console.log(`  ✅ [${i + 1}/${testCases.length}] ${testCase.name}`);
      } catch (error) {
        failed++;
        console.log(`  ❌ [${i + 1}/${testCases.length}] ${testCase.name}: ${error.message}`);
      }

      // 每个测试用例后
      this.afterEach(testCase);
    }

    // 测试后钩子
    this.afterAll();

    // 报告结果
    this.report(passed, failed, testCases.length);

    return { passed, failed, total: testCases.length };
  }

  // 抽象方法：执行测试（子类实现）
  executeTest(testCase) {
    throw new Error('子类必须实现 executeTest');
  }

  // 钩子方法（子类可选择覆盖）
  beforeAll() { /* 默认空 */ }
  beforeEach(testCase) { /* 默认空 */ }
  afterEach(testCase) { /* 默认空 */ }
  afterAll() { /* 默认空 */ }

  report(passed, failed, total) {
    const pct = ((passed / total) * 100).toFixed(1);
    console.log(`\n  📊 结果: ${passed}/${total} 通过 (${pct}%), ${failed} 失败`);
  }
}

// ============ 单元测试运行器 ============

class UnitTestRunner extends TestRunner {
  constructor() {
    super();
    this.mocks = {};
  }

  executeTest(testCase) {
    const result = testCase.fn(this.mocks);
    if (testCase.expected !== undefined) {
      if (result !== testCase.expected) {
        throw new Error(`期望 ${testCase.expected}, 实际 ${result}`);
      }
    }
  }

  beforeAll() {
    console.log(`  📦 初始化测试环境...`);
    this.mocks = { Date: new Date(), Math: Math };
  }

  beforeEach(testCase) {
    // 每个测试前重置 mock
    this.mocks.calls = [];
  }

  afterEach(testCase) {
    // 清理资源
  }

  afterAll() {
    console.log(`  🧹 清理测试环境...`);
  }
}

// ============ 集成测试运行器 ============

class IntegrationTestRunner extends TestRunner {
  constructor() {
    super();
    this.db = null;
  }

  executeTest(testCase) {
    return testCase.fn(this.db);
  }

  beforeAll() {
    console.log(`  🗄️  连接测试数据库...`);
    this.db = { connected: true, tables: ['users', 'orders'] };
  }

  beforeEach(testCase) {
    console.log(`    准备测试数据...`);
    // 插入测试数据
  }

  afterEach(testCase) {
    console.log(`    清理测试数据...`);
    // 删除测试数据
  }

  afterAll() {
    console.log(`  🔌 断开数据库连接...`);
    this.db = null;
  }

  report(passed, failed, total) {
    super.report(passed, failed, total);
    console.log(`  💾 测试报告已保存到 test-reports/`);
  }
}

// ============ 使用 ============

const unitRunner = new UnitTestRunner();
unitRunner.run('数学函数测试', [
  { name: 'add(1, 2) === 3', fn: () => 1 + 2 === 3, expected: true },
  { name: 'multiply(2, 3) === 6', fn: () => 2 * 3 === 6, expected: true },
  { name: 'subtract(5, 3) === 2', fn: () => 5 - 3 === 2, expected: true }
]);

const integrationRunner = new IntegrationTestRunner();
integrationRunner.run('用户模块集成测试', [
  { name: '创建用户', fn: (db) => db.connected === true },
  { name: '查询用户', fn: (db) => db.tables.includes('users') },
  { name: '删除用户', fn: (db) => db.connected === true }
]);
```

## 实现三：构建工具流水线

```javascript
// ============ 场景：前端构建工具 ============

class BuildPipeline {
  // 模板方法：构建流程骨架
  build(entryFile) {
    console.log(`\n🔨 开始构建: ${entryFile}`);

    // 步骤 1: 解析入口
    const ast = this.parse(entryFile);
    console.log(`  [1/5] 解析 AST: ${this.getNodeCount(ast)} 个节点`);

    // 步骤 2: 转换代码（抽象方法）
    const transformed = this.transform(ast);
    console.log(`  [2/5] 代码转换完成`);

    // 步骤 3: 依赖分析（抽象方法）
    const dependencies = this.analyzeDependencies(transformed);
    console.log(`  [3/5] 发现 ${dependencies.length} 个依赖`);

    // 步骤 4: 打包（抽象方法）
    const bundle = this.bundle(transformed, dependencies);
    console.log(`  [4/5] 打包完成: ${bundle.length} bytes`);

    // 步骤 5: 输出（抽象方法）
    this.output(bundle, entryFile);
    console.log(`  [5/5] 输出完成`);

    console.log(`✅ 构建成功`);
    return bundle;
  }

  // 已实现的方法（骨架的一部分）
  parse(entryFile) {
    console.log(`    读取文件: ${entryFile}`);
    return { type: 'Program', body: [], source: entryFile };
  }

  getNodeCount(ast) {
    return ast.body.length + 1;
  }

  // 抽象方法
  transform(ast) { throw new Error('子类实现'); }
  analyzeDependencies(transformed) { throw new Error('子类实现'); }
  bundle(transformed, deps) { throw new Error('子类实现'); }
  output(bundle, entryFile) { throw new Error('子类实现'); }

  // 钩子
  onBuildStart(entryFile) { /* 默认空 */ }
  onBuildEnd(bundle) { /* 默认空 */ }
}

// ============ JS 构建器 ============

class JSBuildPipeline extends BuildPipeline {
  transform(ast) {
    console.log(`    [Babel] 转换 JSX → JS, ES6+ → ES5`);
    return { ...ast, transformed: true, target: 'es5' };
  }

  analyzeDependencies(transformed) {
    return ['react', 'react-dom', 'lodash'];
  }

  bundle(transformed, deps) {
    const code = `// Bundled from ${transformed.source}\n${JSON.stringify(transformed)}\n// Dependencies: ${deps.join(', ')}`;
    return code;
  }

  output(bundle, entryFile) {
    const outFile = entryFile.replace('.jsx', '.js');
    console.log(`    写入: dist/${outFile}`);
  }
}

// ============ CSS 构建器 ============

class CSSBuildPipeline extends BuildPipeline {
  transform(ast) {
    console.log(`    [PostCSS] 自动添加前缀, 压缩`);
    return { ...ast, transformed: true, target: 'css' };
  }

  analyzeDependencies(transformed) {
    return ['normalize.css'];
  }

  bundle(transformed, deps) {
    return `/* Bundled from ${transformed.source} */\n${JSON.stringify(transformed)}`;
  }

  output(bundle, entryFile) {
    const outFile = entryFile.replace('.scss', '.css');
    console.log(`    写入: dist/${outFile}`);
  }
}

// ============ 使用 ============

new JSBuildPipeline().build('src/App.jsx');
new CSSBuildPipeline().build('src/styles.scss');
```

## 要点总结
1. **骨架固定，步骤可变**: 父类定义算法流程，子类实现具体步骤
2. **钩子方法**: 提供可选的扩展点，子类可选择覆盖
3. **代码复用**: 公共逻辑在父类实现，避免子类重复
4. **与策略模式互补**: 模板方法用继承控制流程，策略用组合替换算法
5. **JS 中的体现**: Express 中间件、Koa compose、测试框架（Jest/Mocha）的 run/skip/only 模式
