import { randomUUID } from 'node:crypto';
import type { PoolConnection } from 'mysql2/promise';
import { AppError } from './errors.js';
import { exec, isDup, one, parseJson, type SqlValue } from '../db/sql.js';
import type { RowDataPacket } from 'mysql2/promise';

const KEY_PATTERN = /^[\x21-\x7e]{8,80}$/;

type IdempotencyRow = RowDataPacket & {
  method: string;
  path: string;
  response_status: number;
  response_body: unknown;
};

export type IdempotencyReservation =
  | { mode: 'skip' }
  | { mode: 'new'; id: string }
  | { mode: 'replay'; status: number; data: unknown };

export function requestPath(originalUrl: string): string {
  const path = originalUrl.split('?')[0] ?? originalUrl;
  if (path.length === 0 || path.length > 255) {
    throw new AppError(422, 'VALIDATION_ERROR', 'Invalid request path.');
  }
  return path;
}

export async function reserveIdempotency(
  conn: PoolConnection,
  input: { userId: string; farmId: string | null; key: string | null; method: string; path: string },
): Promise<IdempotencyReservation> {
  if (!input.key) return { mode: 'skip' };
  if (!KEY_PATTERN.test(input.key)) {
    throw new AppError(422, 'VALIDATION_ERROR', 'Invalid idempotency key.', {
      fields: { 'Idempotency-Key': 'invalid_format' },
    });
  }
  const id = randomUUID();
  try {
    await exec(
      conn,
      `INSERT INTO idempotency_keys
        (id, user_id, farm_id, idempotency_key, method, path, response_status, response_body)
       VALUES (?, ?, ?, ?, ?, ?, 0, JSON_OBJECT())`,
      [id, input.userId, input.farmId, input.key, input.method, input.path],
    );
    return { mode: 'new', id };
  } catch (error) {
    if (!isDup(error)) throw error;
    const row = await one<IdempotencyRow>(
      conn,
      `SELECT method, path, response_status, response_body
       FROM idempotency_keys WHERE user_id = ? AND idempotency_key = ?`,
      [input.userId, input.key],
    );
    if (!row) throw error;
    if (row.method !== input.method || row.path !== input.path) {
      throw new AppError(409, 'IDEMPOTENCY_MISMATCH', 'That idempotency key was used for a different request.');
    }
    if (Number(row.response_status) === 0) {
      throw new AppError(409, 'IDEMPOTENCY_IN_PROGRESS', 'That request is still being processed.');
    }
    return { mode: 'replay', status: Number(row.response_status), data: parseJson(row.response_body) };
  }
}

export async function finishIdempotency(
  conn: PoolConnection,
  id: string,
  status: number,
  data: unknown,
): Promise<void> {
  const params: SqlValue[] = [status, JSON.stringify(data), id];
  await exec(conn, 'UPDATE idempotency_keys SET response_status = ?, response_body = ? WHERE id = ?', params);
}
