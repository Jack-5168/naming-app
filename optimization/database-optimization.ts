/**
 * 数据库优化脚本
 *
 * 优化内容：
 * - 添加必要索引（user_id, test_type, created_at）
 * - 查询优化（避免 N+1 查询）
 * - 连接池配置优化
 */

import { Pool, PoolConfig } from "pg";

// ==================== 连接池配置优化 ====================

const POOL_CONFIG: PoolConfig = {
  // 连接池大小 - 根据服务器核心数调整
  max: parseInt(process.env.DB_POOL_MAX || "20"),
  min: parseInt(process.env.DB_POOL_MIN || "4"),

  // 连接超时
  connectionTimeoutMillis: 10000,

  // 空闲连接超时（30 秒）
  idleTimeoutMillis: 30000,

  // 连接最大生命周期（5 分钟）
  maxLifetimeSeconds: 300,

  // 慢查询日志阈值（100ms）
  statement_timeout: 100000,

  // SSL 配置（生产环境）
  ssl:
    process.env.NODE_ENV === "production"
      ? {
          rejectUnauthorized: false,
        }
      : false,
};

/**
 * 优化的数据库连接池
 */
class OptimizedPool {
  private pool: Pool;
  private queryCount: number = 0;
  private slowQueries: Array<{ query: string; duration: number }> = [];

  constructor(config: PoolConfig = POOL_CONFIG) {
    this.pool = new Pool(config);
    this.setupPoolListeners();
  }

  private setupPoolListeners() {
    // 连接错误处理
    this.pool.on("error", (err, client) => {
      console.error("[DBPool] Unexpected error on idle client:", err);
    });

    // 连接创建
    this.pool.on("connect", (client) => {
      console.log("[DBPool] New client connected");
    });

    // 连接移除
    this.pool.on("remove", (client) => {
      console.log("[DBPool] Client removed from pool");
    });
  }

  /**
   * 执行查询（带性能监控）
   */
  async query<T = any>(
    text: string,
    params?: any[],
  ): Promise<{ rows: T[]; duration: number }> {
    const start = Date.now();
    const client = await this.pool.connect();

    try {
      const result = await client.query<T>(text, params);
      const duration = Date.now() - start;

      this.queryCount++;

      // 记录慢查询
      if (duration > 100) {
        this.slowQueries.push({ query: text, duration });
        console.warn(
          `[DBPool] Slow query (${duration}ms):`,
          text.substring(0, 100),
        );
      }

      return { rows: result.rows, duration };
    } finally {
      client.release();
    }
  }

  /**
   * 事务执行
   */
  async transaction<T>(fn: (client: any) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();

    try {
      await client.query("BEGIN");
      const result = await fn(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * 获取连接池统计
   */
  getStats() {
    return {
      totalCount: this.pool.totalCount,
      idleCount: this.pool.idleCount,
      waitingCount: this.pool.waitingCount,
      queryCount: this.queryCount,
      slowQueries: this.slowQueries.length,
    };
  }

  /**
   * 获取慢查询日志
   */
  getSlowQueries(limit: number = 10) {
    return this.slowQueries.slice(-limit);
  }

  /**
   * 关闭连接池
   */
  async shutdown() {
    await this.pool.end();
  }
}

// ==================== 索引优化脚本 ====================

const INDEX_DEFINITIONS = [
  // 用户相关索引
  {
    table: "users",
    name: "idx_users_email",
    columns: ["email"],
    unique: true,
  },
  {
    table: "users",
    name: "idx_users_created_at",
    columns: ["created_at"],
    unique: false,
  },
  {
    table: "users",
    name: "idx_users_status",
    columns: ["status"],
    unique: false,
  },

  // 测试结果表索引
  {
    table: "test_results",
    name: "idx_test_results_user_id",
    columns: ["user_id"],
    unique: false,
  },
  {
    table: "test_results",
    name: "idx_test_results_test_type",
    columns: ["test_type"],
    unique: false,
  },
  {
    table: "test_results",
    name: "idx_test_results_created_at",
    columns: ["created_at"],
    unique: false,
  },
  {
    table: "test_results",
    name: "idx_test_results_composite",
    columns: ["user_id", "test_type", "created_at"],
    unique: false,
  },

  // 会员表索引
  {
    table: "memberships",
    name: "idx_memberships_user_id",
    columns: ["user_id"],
    unique: false,
  },
  {
    table: "memberships",
    name: "idx_memberships_status",
    columns: ["status"],
    unique: false,
  },
  {
    table: "memberships",
    name: "idx_memberships_expire_at",
    columns: ["expire_at"],
    unique: false,
  },

  // 分享卡片表索引
  {
    table: "share_cards",
    name: "idx_share_cards_user_id",
    columns: ["user_id"],
    unique: false,
  },
  {
    table: "share_cards",
    name: "idx_share_cards_popularity",
    columns: ["view_count", "created_at"],
    unique: false,
  },

  // 题库表索引
  {
    table: "questions",
    name: "idx_questions_category",
    columns: ["category"],
    unique: false,
  },
  {
    table: "questions",
    name: "idx_questions_difficulty",
    columns: ["difficulty"],
    unique: false,
  },
  {
    table: "questions",
    name: "idx_questions_status",
    columns: ["status"],
    unique: false,
  },
];

/**
 * 创建索引
 */
async function createIndexes(pool: OptimizedPool) {
  console.log("[DBOptimization] Starting index creation...");

  for (const index of INDEX_DEFINITIONS) {
    const indexName = index.name;
    const tableName = index.table;
    const columns = index.columns.join(", ");
    const unique = index.unique ? "UNIQUE " : "";

    const sql = `
      CREATE ${unique}INDEX IF NOT EXISTS ${indexName}
      ON ${tableName} (${columns})
    `;

    try {
      const result = await pool.query(sql);
      console.log(`[DBOptimization] ✓ Index created: ${indexName}`);
    } catch (error: any) {
      console.error(
        `[DBOptimization] ✗ Failed to create ${indexName}:`,
        error.message,
      );
    }
  }

  console.log("[DBOptimization] Index creation completed");
}

/**
 * 删除索引（回滚用）
 */
async function dropIndexes(pool: OptimizedPool, indexNames: string[]) {
  console.log("[DBOptimization] Dropping indexes...");

  for (const indexName of indexNames) {
    try {
      await pool.query(`DROP INDEX IF EXISTS ${indexName}`);
      console.log(`[DBOptimization] ✓ Index dropped: ${indexName}`);
    } catch (error: any) {
      console.error(
        `[DBOptimization] ✗ Failed to drop ${indexName}:`,
        error.message,
      );
    }
  }
}

// ==================== 查询优化 ====================

/**
 * 避免 N+1 查询的优化示例
 */
class QueryOptimizer {
  private pool: OptimizedPool;

  constructor(pool: OptimizedPool) {
    this.pool = pool;
  }

  /**
   * ❌ 错误示例：N+1 查询
   * 问题：先查用户列表，再循环查询每个用户的测试结果
   */
  async badNPlus1Query(userIds: string[]) {
    // 第一次查询：获取用户列表
    const usersQuery = "SELECT * FROM users WHERE id = ANY($1)";
    const usersResult = await this.pool.query(usersQuery, [userIds]);

    // N 次查询：为每个用户获取测试结果
    const results = [];
    for (const user of usersResult.rows) {
      const testQuery = "SELECT * FROM test_results WHERE user_id = $1";
      const testResult = await this.pool.query(testQuery, [user.id]);
      results.push({ ...user, tests: testResult.rows });
    }

    return results;
  }

  /**
   * ✅ 优化示例：使用 JOIN 或批量查询
   * 解决：通过单次查询获取所有数据
   */
  async optimizedQuery(userIds: string[]) {
    const query = `
      SELECT 
        u.id,
        u.email,
        u.name,
        tr.id as test_id,
        tr.test_type,
        tr.score,
        tr.created_at as test_created_at
      FROM users u
      LEFT JOIN test_results tr ON u.id = tr.user_id
      WHERE u.id = ANY($1)
      ORDER BY u.id, tr.created_at DESC
    `;

    const result = await this.pool.query(query, [userIds]);

    // 在内存中组织数据
    const userMap = new Map();
    for (const row of result.rows) {
      if (!userMap.has(row.id)) {
        userMap.set(row.id, {
          id: row.id,
          email: row.email,
          name: row.name,
          tests: [],
        });
      }

      if (row.test_id) {
        userMap.get(row.id).tests.push({
          id: row.test_id,
          test_type: row.test_type,
          score: row.score,
          created_at: row.test_created_at,
        });
      }
    }

    return Array.from(userMap.values());
  }

  /**
   * ✅ 优化示例：使用子查询预加载
   */
  async optimizedWithSubquery(userIds: string[]) {
    const query = `
      WITH user_tests AS (
        SELECT 
          user_id,
          json_agg(json_build_object(
            'id', id,
            'test_type', test_type,
            'score', score,
            'created_at', created_at
          )) as tests
        FROM test_results
        WHERE user_id = ANY($1)
        GROUP BY user_id
      )
      SELECT 
        u.id,
        u.email,
        u.name,
        COALESCE(ut.tests, '[]'::json) as tests
      FROM users u
      LEFT JOIN user_tests ut ON u.id = ut.user_id
      WHERE u.id = ANY($1)
    `;

    const result = await this.pool.query(query, [userIds]);
    return result.rows;
  }

  /**
   * ✅ 优化示例：批量更新
   */
  async batchUpdate(updates: Array<{ id: string; data: any }>) {
    // 使用 CASE 语句批量更新
    const ids = updates.map((u) => u.id);
    const values = updates.map((u) => u.data);

    const query = `
      UPDATE users
      SET 
        updated_at = NOW(),
        data = CASE id
          ${updates.map((_, i) => `WHEN $${i * 2 + 1} THEN $${i * 2 + 2}`).join(" ")}
        END
      WHERE id = ANY($${ids.length * 2 + 1})
    `;

    const params = updates.flatMap((u) => [u.id, u.data]);
    params.push(ids);

    return this.pool.query(query, params);
  }

  /**
   * ✅ 优化示例：分页查询（使用游标）
   */
  async cursorPagination(table: string, limit: number, cursor?: string) {
    const query = `
      SELECT *
      FROM ${table}
      WHERE created_at < $1
      ORDER BY created_at DESC
      LIMIT $2
    `;

    const cursorTime = cursor || new Date().toISOString();
    const result = await this.pool.query(query, [cursorTime, limit + 1]);

    const hasMore = result.rows.length > limit;
    const rows = hasMore ? result.rows.slice(0, limit) : result.rows;
    const nextCursor = hasMore ? rows[rows.length - 1].created_at : null;

    return {
      data: rows,
      nextCursor,
      hasMore,
    };
  }

  /**
   * ✅ 优化示例：使用 EXPLAIN ANALYZE 分析查询
   */
  async analyzeQuery(query: string, params: any[] = []) {
    const explainQuery = `EXPLAIN ANALYZE ${query}`;
    const result = await this.pool.query(explainQuery, params);

    console.log("[Query Analysis]");
    console.log(result.rows.map((r: any) => r["QUERY PLAN"]).join("\n"));

    return result.rows;
  }
}

// ==================== 数据库迁移工具 ====================

/**
 * 运行数据库优化
 */
async function runOptimization() {
  console.log("[DBOptimization] Starting database optimization...\n");

  const pool = new OptimizedPool();

  try {
    // 1. 创建索引
    await createIndexes(pool);

    // 2. 分析表统计
    console.log("\n[DBOptimization] Analyzing tables...");
    await pool.query("ANALYZE users");
    await pool.query("ANALYZE test_results");
    await pool.query("ANALYZE memberships");
    await pool.query("ANALYZE questions");
    console.log("[DBOptimization] ✓ Table analysis completed");

    // 3. 输出连接池统计
    console.log("\n[DBOptimization] Pool stats:", pool.getStats());

    // 4. 查询优化器示例
    const optimizer = new QueryOptimizer(pool);
    console.log("\n[DBOptimization] Query optimizer ready");
  } catch (error) {
    console.error("[DBOptimization] Error:", error);
    throw error;
  } finally {
    await pool.shutdown();
  }
}

// ==================== 导出 ====================

export {
  POOL_CONFIG,
  OptimizedPool,
  QueryOptimizer,
  INDEX_DEFINITIONS,
  createIndexes,
  dropIndexes,
  runOptimization,
};

export default {
  POOL_CONFIG,
  OptimizedPool,
  QueryOptimizer,
  runOptimization,
};
