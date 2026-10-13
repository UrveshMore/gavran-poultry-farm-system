import mysql from 'mysql2/promise';
import { env } from '../config/env.js';

function assertIdentifier(value: string, label: string): string {
  if (!/^[A-Za-z0-9_]+$/.test(value)) {
    throw new Error(`Unsafe ${label}.`);
  }
  return value;
}

export async function ensureTestDatabase(): Promise<void> {
  if (!env.DB_NAME.endsWith('_test')) {
    throw new Error('ensureTestDatabase refuses a name that does not end with _test.');
  }
  try {
    const existing = await mysql.createConnection({
      host: env.DB_HOST,
      port: env.DB_PORT,
      user: env.DB_USER,
      password: env.DB_PASSWORD,
      database: env.DB_NAME,
    });
    await existing.ping();
    await existing.end();
    return;
  } catch {
    // Create it with the admin account below.
  }

  const database = assertIdentifier(env.DB_NAME, 'database name');
  const user = assertIdentifier(env.DB_USER, 'database user');
  const admin = await mysql.createConnection({
    host: env.DB_HOST,
    port: env.DB_PORT,
    user: env.DB_ADMIN_USER,
    password: env.DB_ADMIN_PASSWORD,
    multipleStatements: true,
  });
  try {
    await admin.query(
      `CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci`,
    );
    await admin.query(`GRANT ALL PRIVILEGES ON \`${database}\`.* TO '${user}'@'%'`);
    await admin.query('FLUSH PRIVILEGES');
  } finally {
    await admin.end();
  }
}
