import { randomUUID } from 'node:crypto';
import mysql from 'mysql2/promise';
import { env } from '../config/env.js';
import { migrate } from '../db/migrate.js';

const DRILL_DB = 'gavran_restore_drill';

function assertIdentifier(value: string, label: string): string {
  if (!/^[A-Za-z0-9_]+$/.test(value)) throw new Error(`Unsafe ${label}.`);
  return value;
}

function assertDrillDatabase(name: string): string {
  const database = assertIdentifier(name, 'database name');
  if (database !== DRILL_DB) throw new Error('The restore drill only uses gavran_restore_drill.');
  if (database === env.DB_NAME) throw new Error('Refusing to drill the application database.');
  return database;
}

async function admin() {
  return mysql.createConnection({
    host: env.DB_HOST,
    port: env.DB_PORT,
    user: env.DB_ADMIN_USER,
    password: env.DB_ADMIN_PASSWORD,
    multipleStatements: true,
  });
}

async function recreate(database: string): Promise<void> {
  const user = assertIdentifier(env.DB_USER, 'database user');
  const root = await admin();
  try {
    await root.query(`DROP DATABASE IF EXISTS \`${database}\``);
    await root.query(`CREATE DATABASE \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci`);
    await root.query(`GRANT ALL PRIVILEGES ON \`${database}\`.* TO '${user}'@'%'`);
    await root.query('FLUSH PRIVILEGES');
  } finally {
    await root.end();
  }
}

async function drop(database: string): Promise<void> {
  const root = await admin();
  try {
    await root.query(`DROP DATABASE IF EXISTS \`${database}\``);
  } finally {
    await root.end();
  }
}

async function appConn(database: string) {
  return mysql.createConnection({
    host: env.DB_HOST,
    port: env.DB_PORT,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database,
    timezone: 'Z',
  });
}

export type RestoreDrillResult = {
  database: typeof DRILL_DB;
  restoredEmail: string;
  restoredId: string;
  databaseRemoved: true;
  retention: { status: 'not_chosen'; reason: 'decision 15 is open' };
  recovery: { rpo: null; rto: null; reason: 'decision 12 is open' };
};

export async function runRestoreDrill(): Promise<RestoreDrillResult> {
  const database = assertDrillDatabase(DRILL_DB);
  const id = randomUUID();
  const email = `restore-drill-${id.slice(0, 8)}@example.com`;
  const passwordHash = 'drill-not-a-login';
  try {
    await recreate(database);
    await migrate(database);
    const source = await appConn(database);
    try {
      await source.execute(
        `INSERT INTO users (id, email, display_name, password_hash, preferred_locale) VALUES (?, ?, ?, ?, 'en')`,
        [id, email, 'Restore Drill', passwordHash],
      );
    } finally {
      await source.end();
    }

    const backup = { id, email, displayName: 'Restore Drill', passwordHash };
    await recreate(database);
    await migrate(database);
    const restored = await appConn(database);
    try {
      await restored.execute(
        `INSERT INTO users (id, email, display_name, password_hash, preferred_locale) VALUES (?, ?, ?, ?, 'en')`,
        [backup.id, backup.email, backup.displayName, backup.passwordHash],
      );
      const [rows] = await restored.query(`SELECT id, email FROM users WHERE id = ?`, [backup.id]);
      const row = (rows as Array<{ id: string; email: string }>)[0];
      if (!row || row.email !== backup.email) throw new Error('Restored row did not match the backup.');
    } finally {
      await restored.end();
    }
  } finally {
    await drop(database);
  }

  const root = await admin();
  try {
    const [rows] = await root.query(`SELECT SCHEMA_NAME AS name FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = ?`, [database]);
    if ((rows as unknown[]).length > 0) throw new Error('The drill database was not removed.');
  } finally {
    await root.end();
  }

  return {
    database: DRILL_DB,
    restoredEmail: email,
    restoredId: id,
    databaseRemoved: true,
    retention: { status: 'not_chosen', reason: 'decision 15 is open' },
    recovery: { rpo: null, rto: null, reason: 'decision 12 is open' },
  };
}
