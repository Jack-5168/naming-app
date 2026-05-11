/**
 * 单例模式 (Singleton Pattern) 完整实现
 * 
 * 确保一个类只有一个实例，并提供全局访问点
 */

// ============================================
// 1. 基础单例 - 使用闭包
// ============================================
const SingletonBasic = (function() {
  let instance;
  
  function createInstance() {
    return {
      name: 'Singleton Instance',
      getData() {
        return 'Hello from Singleton';
      },
      timestamp: Date.now()
    };
  }
  
  return {
    getInstance() {
      if (!instance) {
        instance = createInstance();
        console.log('[Singleton] Instance created');
      } else {
        console.log('[Singleton] Returning existing instance');
      }
      return instance;
    }
  };
})();

// ============================================
// 2. ES6 Class 单例
// ============================================
class SingletonClass {
  constructor() {
    if (SingletonClass.instance) {
      return SingletonClass.instance;
    }
    
    this.data = [];
    this.name = 'Singleton Class Instance';
    this.createdAt = Date.now();
    SingletonClass.instance = this;
    console.log('[SingletonClass] Instance created');
  }
  
  addData(item) {
    this.data.push(item);
    console.log(`[SingletonClass] Added: ${item}`);
  }
  
  getData() {
    return this.data;
  }
  
  clear() {
    this.data = [];
    console.log('[SingletonClass] Data cleared');
  }
  
  getInfo() {
    return {
      name: this.name,
      dataCount: this.data.length,
      createdAt: this.createdAt
    };
  }
}

// ============================================
// 3. 配置管理器单例
// ============================================
class ConfigManager {
  constructor() {
    if (ConfigManager.instance) {
      return ConfigManager.instance;
    }
    
    this.config = {
      app: {
        name: 'MyApp',
        version: '1.0.0',
        debug: false
      },
      database: {
        host: 'localhost',
        port: 5432,
        name: 'mydb'
      },
      api: {
        baseUrl: 'https://api.example.com',
        timeout: 5000
      }
    };
    
    ConfigManager.instance = this;
    console.log('[ConfigManager] Instance created');
  }
  
  get(path) {
    const value = path.split('.').reduce((obj, key) => obj?.[key], this.config);
    console.log(`[ConfigManager] Get "${path}":`, value);
    return value;
  }
  
  set(path, value) {
    const keys = path.split('.');
    const lastKey = keys.pop();
    const target = keys.reduce((obj, key) => obj[key], this.config);
    if (target && lastKey) {
      const oldValue = target[lastKey];
      target[lastKey] = value;
      console.log(`[ConfigManager] Set "${path}": ${oldValue} → ${value}`);
    }
  }
  
  getAll() {
    return JSON.parse(JSON.stringify(this.config));
  }
  
  loadFromFile(configObj) {
    this.config = { ...this.config, ...configObj };
    console.log('[ConfigManager] Config loaded from file');
  }
}

// ============================================
// 4. 惰性单例 - 延迟初始化
// ============================================
class LazySingleton {
  constructor() {
    if (LazySingleton.instance) {
      return LazySingleton.instance;
    }
    
    this.initialized = false;
    this.expensiveResource = null;
    this.initCount = 0;
    LazySingleton.instance = this;
    console.log('[LazySingleton] Instance created (not initialized)');
  }
  
  getExpensiveResource() {
    if (!this.initialized) {
      console.log('[LazySingleton] Initializing expensive resource...');
      this.expensiveResource = {
        created: Date.now(),
        data: 'Expensive data loaded',
        initTime: Math.random() * 1000
      };
      this.initialized = true;
      this.initCount++;
    } else {
      console.log('[LazySingleton] Returning cached resource');
    }
    return this.expensiveResource;
  }
  
  isInitialized() {
    return this.initialized;
  }
  
  getInitCount() {
    return this.initCount;
  }
}

// ============================================
// 5. 数据库连接池单例
// ============================================
class DatabaseConnection {
  constructor() {
    if (DatabaseConnection.instance) {
      return DatabaseConnection.instance;
    }
    
    this.connections = [];
    this.maxConnections = 10;
    this.connected = false;
    DatabaseConnection.instance = this;
    console.log('[DatabaseConnection] Connection pool created');
  }
  
  async connect() {
    if (this.connected) {
      console.log('[DatabaseConnection] Already connected');
      return true;
    }
    
    console.log('[DatabaseConnection] Connecting to database...');
    await new Promise(resolve => setTimeout(resolve, 100));
    this.connected = true;
    console.log('[DatabaseConnection] Connected!');
    return true;
  }
  
  getConnection() {
    if (!this.connected) {
      throw new Error('Not connected to database');
    }
    
    if (this.connections.length >= this.maxConnections) {
      console.log('[DatabaseConnection] Connection pool full');
      return null;
    }
    
    const conn = {
      id: Date.now() + Math.random(),
      createdAt: Date.now()
    };
    this.connections.push(conn);
    console.log(`[DatabaseConnection] Connection created (${this.connections.length}/${this.maxConnections})`);
    return conn;
  }
  
  releaseConnection(conn) {
    const index = this.connections.indexOf(conn);
    if (index > -1) {
      this.connections.splice(index, 1);
      console.log(`[DatabaseConnection] Connection released (${this.connections.length}/${this.maxConnections})`);
    }
  }
  
  getPoolStatus() {
    return {
      connected: this.connected,
      activeConnections: this.connections.length,
      maxConnections: this.maxConnections
    };
  }
}

// ============================================
// 测试代码
// ============================================
function runTests() {
  console.log('\n' + '='.repeat(60));
  console.log('单例模式测试');
  console.log('='.repeat(60));
  
  // 测试 1: 基础单例
  console.log('\n[测试 1] 基础单例');
  const s1 = SingletonBasic.getInstance();
  const s2 = SingletonBasic.getInstance();
  console.log('Same instance:', s1 === s2);
  console.log('Data:', s1.getData());
  
  // 测试 2: ES6 Class 单例
  console.log('\n[测试 2] ES6 Class 单例');
  const c1 = new SingletonClass();
  const c2 = new SingletonClass();
  console.log('Same instance:', c1 === c2);
  c1.addData('item1');
  c1.addData('item2');
  console.log('Shared data:', c2.getData());
  console.log('Info:', c1.getInfo());
  
  // 测试 3: 配置管理器
  console.log('\n[测试 3] 配置管理器');
  const config1 = new ConfigManager();
  const config2 = new ConfigManager();
  console.log('Same instance:', config1 === config2);
  console.log('App name:', config1.get('app.name'));
  config1.set('app.debug', true);
  console.log('Debug mode:', config2.get('app.debug'));
  
  // 测试 4: 惰性单例
  console.log('\n[测试 4] 惰性单例');
  const lazy1 = new LazySingleton();
  console.log('Initialized:', lazy1.isInitialized());
  const resource1 = lazy1.getExpensiveResource();
  console.log('Initialized after get:', lazy1.isInitialized());
  const lazy2 = new LazySingleton();
  const resource2 = lazy2.getExpensiveResource();
  console.log('Same resource:', resource1.created === resource2.created);
  
  // 测试 5: 数据库连接池
  console.log('\n[测试 5] 数据库连接池');
  const db1 = new DatabaseConnection();
  const db2 = new DatabaseConnection();
  console.log('Same instance:', db1 === db2);
  
  db1.connect().then(() => {
    const conn1 = db1.getConnection();
    const conn2 = db1.getConnection();
    console.log('Pool status:', db1.getPoolStatus());
    db1.releaseConnection(conn1);
    console.log('Pool status after release:', db1.getPoolStatus());
  });
  
  console.log('\n' + '='.repeat(60));
  console.log('测试完成');
  console.log('='.repeat(60) + '\n');
}

// 导出所有单例
module.exports = {
  SingletonBasic,
  SingletonClass,
  ConfigManager,
  LazySingleton,
  DatabaseConnection,
  runTests
};

// 如果直接运行此文件，执行测试
if (require.main === module) {
  runTests();
}
