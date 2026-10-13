import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import mysql, { type RowDataPacket } from 'mysql2/promise';
import { env } from '../config/env.js';

const migrationsDir = resolve(fileURLToPath(new URL('../../../database/migrations', import.meta.url)));

function connectionOptions(database: string) {
  return {
    host: env.DB_HOST,
    port: env.DB_PORT,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database,
    timezone: 'Z',
    multipleStatements: true,
    charset: 'utf8mb4',
  };
}

export async function migrate(database = env.DB_NAME): Promise<string[]> {
  const conn = await mysql.createConnection(connectionOptions(database));
  const applied: string[] = [];
  try {
    await conn.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version VARCHAR(64) NOT NULL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        applied_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);
    const [rows] = await conn.query<RowDataPacket[]>('SELECT version FROM schema_migrations');
    const have = new Set(rows.map((row) => String(row.version)));
    const files = (await readdir(migrationsDir))
      .filter((file) => /^\d+_.*\.sql$/.test(file) && !file.endsWith('.down.sql'))
      .sort();
    for (const file of files) {
      const version = file.split('_')[0];
      if (!version || have.has(version)) continue;
      const sql = await readFile(resolve(migrationsDir, file), 'utf8');
      await conn.query(sql);
      await conn.query('INSERT INTO schema_migrations (version, name) VALUES (?, ?)', [version, file]);
      applied.push(version);
    }
    return applied;
  } finally {
    await conn.end();
  }
}

export async function rollback(database = env.DB_NAME): Promise<string> {
  const conn = await mysql.createConnection(connectionOptions(database));
  try {
    const [rows] = await conn.query<RowDataPacket[]>(
      'SELECT version, name FROM schema_migrations ORDER BY version DESC LIMIT 1',
    );
    const latest = rows[0];
    if (!latest) {
      throw new Error('No migrations to roll back.');
    }
    const version = String(latest.version);
    const name = String(latest.name);
    const downName = name.replace(/\.sql$/, '.down.sql');
    const sql = await readFile(resolve(migrationsDir, downName), 'utf8');
    await conn.query(sql);
    await conn.query('DELETE FROM schema_migrations WHERE version = ?', [version]);
    return version;
  } finally {
    await conn.end();
  }
}

export function migrationsDirectory(): string {
  return migrationsDir;
}
