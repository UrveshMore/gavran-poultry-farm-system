import type { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';

export type Db = Pool | PoolConnection;
export type SqlValue = string | number | Date | null;

export async function many<T extends RowDataPacket>(db: Db, sql: string, params: SqlValue[] = []): Promise<T[]> {
  const [rows] = await db.execute<T[]>(sql, params);
  return rows;
}

export async function one<T extends RowDataPacket>(db: Db, sql: string, params: SqlValue[] = []): Promise<T | null> {
  const rows = await many<T>(db, sql, params);
  return rows[0] ?? null;
}

export async function exec(db: Db, sql: string, params: SqlValue[] = []): Promise<ResultSetHeader> {
  const [result] = await db.execute<ResultSetHeader>(sql, params);
  return result;
}

export function isDup(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && (error as { code?: string }).code === 'ER_DUP_ENTRY';
}

export function iso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

export function asNumber(value: number | string | bigint): number {
  return typeof value === 'bigint' ? Number(value) : Number(value);
}

export function parseJson(value: unknown): unknown {
  if (typeof value === 'string') {
    return JSON.parse(value) as unknown;
  }
  return value;
}
