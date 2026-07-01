import type { Pool, PoolConnection, PoolOptions, ResultSetHeader, RowDataPacket, ExecuteValues } from 'mysql2/promise';
import mysql from 'mysql2/promise';
import type { AppConfig } from '../types';

let pool: Pool | null = null;

function createPoolOptions(config: AppConfig): PoolOptions {
  const options: PoolOptions = {
    host: config.dbHost,
    port: config.dbPort,
    database: config.dbName,
    user: config.dbUser,
    password: config.dbPassword,
    waitForConnections: true,
    connectionLimit: 10,
  };

  if (config.dbSsl) {
    options.ssl = { rejectUnauthorized: true };
  }

  return options;
}

const SCHEMA_STATEMENTS = [
  `
  CREATE TABLE IF NOT EXISTS tasks (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    created_at VARCHAR(40) NOT NULL,
    active TINYINT(1) NOT NULL DEFAULT 1,
    KEY idx_tasks_active (active)
  )
  `,
  `
  CREATE TABLE IF NOT EXISTS rota_users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id VARCHAR(32) NOT NULL UNIQUE,
    added_at VARCHAR(40) NOT NULL
  )
  `,
  `
  CREATE TABLE IF NOT EXISTS rota_state (
    id INT PRIMARY KEY,
    rotation_index INT NOT NULL DEFAULT 0
  )
  `,
  `
  CREATE TABLE IF NOT EXISTS assignments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    week_date VARCHAR(10) NOT NULL,
    task_id INT NOT NULL,
    user_id VARCHAR(32) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'Assigned',
    message_id VARCHAR(32) NULL,
    channel_id VARCHAR(32) NULL,
    created_at VARCHAR(40) NOT NULL,
    KEY idx_assignments_week_date (week_date),
    KEY idx_assignments_user_id (user_id),
    FOREIGN KEY (task_id) REFERENCES tasks(id)
  )
  `,
  `INSERT IGNORE INTO rota_state (id, rotation_index) VALUES (1, 0)`,
];

export interface TableStat {
  name: string;
  rows: number;
}

export interface DatabaseHealth {
  ok: boolean;
  pingMs: number;
  host: string;
  database: string;
  user: string;
  tables: TableStat[];
  error?: string;
}

export async function initDatabase(config: AppConfig): Promise<void> {
  if (pool) {
    return;
  }

  pool = mysql.createPool(createPoolOptions(config));

  for (const statement of SCHEMA_STATEMENTS) {
    await pool.execute(statement);
  }

  const transport = config.dbSsl ? 'TLS' : 'plain';
  console.log(`Database initialized (MySQL @ ${config.dbHost}/${config.dbName}, ${transport})`);
}

export function getPool(): Pool {
  if (!pool) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return pool;
}

export async function queryRows<T extends RowDataPacket>(
  sql: string,
  params: ExecuteValues = [],
): Promise<T[]> {
  const [rows] = await getPool().query<T[]>(sql, params);
  return rows;
}

export async function queryOne<T extends RowDataPacket>(
  sql: string,
  params: ExecuteValues = [],
): Promise<T | undefined> {
  const rows = await queryRows<T>(sql, params);
  return rows[0];
}

export async function execute(sql: string, params: ExecuteValues = []): Promise<ResultSetHeader> {
  const [result] = await getPool().execute<ResultSetHeader>(sql, params);
  return result;
}

export async function withTransaction<T>(fn: (connection: PoolConnection) => Promise<T>): Promise<T> {
  const connection = await getPool().getConnection();
  try {
    await connection.beginTransaction();
    const result = await fn(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function logDatabaseStats(): Promise<void> {
  const tasks = await queryOne<RowDataPacket & { count: number }>(
    'SELECT COUNT(*) AS count FROM tasks',
  );
  const rotaUsers = await queryOne<RowDataPacket & { count: number }>(
    'SELECT COUNT(*) AS count FROM rota_users',
  );
  console.log(
    `Database contains ${tasks?.count ?? 0} task(s) and ${rotaUsers?.count ?? 0} rota user(s).`,
  );
}

export async function checkDatabaseHealth(config: AppConfig): Promise<DatabaseHealth> {
  const base = {
    host: config.dbHost,
    database: config.dbName,
    user: config.dbUser,
    tables: [] as TableStat[],
    pingMs: 0,
    ok: false,
  };

  try {
    const start = Date.now();
    await getPool().query('SELECT 1');
    base.pingMs = Date.now() - start;

    const tableNames = ['tasks', 'rota_users', 'assignments', 'rota_state'];
    for (const name of tableNames) {
      const row = await queryOne<RowDataPacket & { count: number }>(
        `SELECT COUNT(*) AS count FROM ${name}`,
      );
      base.tables.push({ name, rows: Number(row?.count ?? 0) });
    }

    return { ...base, ok: true };
  } catch (error) {
    return {
      ...base,
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown database error',
    };
  }
}

export async function closeDatabase(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
