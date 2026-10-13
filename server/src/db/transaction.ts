import type { PoolConnection } from 'mysql2/promise';
import { pool } from './pool.js';

export async function withTransaction<T>(fn: (conn: PoolConnection) => Promise<T>): Promise<T> {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (error) {
    try {
      await conn.rollback();
    } catch {
      // The original error is the one callers need.
    }
    throw error;
  } finally {
    conn.release();
  }
}
