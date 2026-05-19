/**
 * PostgreSQL 数据库客户端
 * 适配火山引擎 PostgreSQL
 */
import { Pool, PoolClient, QueryResult } from 'pg';

// 数据库连接配置
const getPoolConfig = () => {
  // 优先使用环境变量
  const connectionString = process.env.POSTGRES_URL || 
    process.env.DATABASE_URL ||
    (process.env.PGHOST ? `
      postgresql://${process.env.PGUSER}:${process.env.PGPASSWORD}@${process.env.PGHOST}:${process.env.PGPORT}/${process.env.PGDATABASE}?sslmode=require
    `.trim() : null);

  if (!connectionString) {
    throw new Error('数据库连接字符串未设置，请设置 POSTGRES_URL 或 DATABASE_URL 环境变量');
  }

  return {
    connectionString,
    ssl: {
      rejectUnauthorized: false,  // 火山引擎需要
    },
    max: 20,  // 连接池最大连接数
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  };
};

// 全局连接池
let pool: Pool | null = null;

/**
 * 获取数据库连接池
 */
export function getPool(): Pool {
  if (!pool) {
    pool = new Pool(getPoolConfig());
    
    // 连接池错误处理
    pool.on('error', (err) => {
      console.error('[PostgreSQL] 连接池错误:', err);
    });

    console.log('[PostgreSQL] 连接池已创建');
  }
  return pool;
}

/**
 * 执行 SQL 查询
 */
export async function query<T = any>(
  sql: string,
  params?: any[]
): Promise<QueryResult<T>> {
  const client = await getPool().connect();
  try {
    const result = await client.query(sql, params);
    return result;
  } finally {
    client.release();
  }
}

/**
 * 执行事务
 */
export async function transaction<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * 测试数据库连接
 */
export async function testConnection(): Promise<boolean> {
  try {
    const result = await query('SELECT NOW() as now');
    console.log('[PostgreSQL] 连接成功:', result.rows[0].now);
    return true;
  } catch (error) {
    console.error('[PostgreSQL] 连接失败:', error);
    return false;
  }
}

/**
 * 关闭连接池
 */
export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    console.log('[PostgreSQL] 连接池已关闭');
  }
}
