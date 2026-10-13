import { createServer, type Server } from 'node:http';
import type { RowDataPacket } from 'mysql2/promise';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { pool } from '../../src/db/pool.js';
import { loginThrottle } from '../../src/modules/auth/service.js';
import { runRestoreDrill } from '../../src/ops/restoreDrill.js';

const app = createApp();
let server: Server;
const password = 'correct-horse-battery';

beforeAll(async () => {
  server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
});
afterAll(async () => {
  await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
});

function agent() {
  return request.agent(server);
}
type Http = ReturnType<typeof agent>;

async function csrf(http: Http): Promise<string> {
  const res = await http.get('/api/v1/auth/csrf');
  return res.body.data.csrfToken as string;
}
async function send(http: Http, method: 'post' | 'patch', path: string, body: object) {
  const token = await csrf(http);
  return http[method](path).set('X-CSRF-Token', token).send(body);
}

beforeEach(async () => {
  const conn = await pool.getConnection();
  try {
    await conn.query('SET FOREIGN_KEY_CHECKS = 0');
    for (const table of [
      'parentage_records', 'task_training_requirements', 'training_completions', 'training_assignments', 'training_items', 'attendance_records', 'idempotency_keys', 'audit_logs', 'expense_entries', 'expense_categories', 'order_lines', 'orders', 'market_prices', 'customers',
      'loss_incidents', 'sex_counts', 'range_areas', 'batch_movements', 'batches', 'bird_types', 'membership_permission_grants', 'sheds', 'farm_settings',
      'farm_memberships', 'sessions', 'password_reset_tokens', 'farms', 'users',
    ]) {
      await conn.query(`TRUNCATE TABLE \`${table}\``);
    }
    await conn.query('SET FOREIGN_KEY_CHECKS = 1');
  } finally {
    conn.release();
  }
  loginThrottle.reset();
});

describe('backup and retention placeholders', () => {
  it('restores a row into an isolated database and leaves retention unset', async () => {
    const http = agent();
    expect((await send(http, 'post', '/api/v1/auth/register', {
      email: 'owner@example.com', password, displayName: 'Asha More', preferredLocale: 'en',
    })).status).toBe(201);
    const farm = await send(http, 'post', '/api/v1/farms', {
      name: 'Gavran Farm', code: 'HOME', timezone: 'UTC', locale: 'en', contactName: '', contactPhone: '',
      contactEmail: '', addressLine: '', weightUnit: 'kg', volumeUnit: 'L',
    });
    const farmId = farm.body.data.id as string;
    const page = await http.get(`/api/v1/farms/${farmId}/safeguards`);
    expect(page.status).toBe(200);
    expect(page.body.data.retention).toEqual({ status: 'not_chosen', reason: 'decision 15 is open' });
    expect(page.body.data.recovery).toEqual({ rpo: null, rto: null, reason: 'decision 12 is open' });
    expect(page.body.data.backup.schedule).toBe('not_chosen');
    expect(JSON.stringify(page.body)).not.toMatch(/\d+\s*(hour|minute|day|year)/i);

    const drill = await runRestoreDrill();
    expect(drill.database).toBe('gavran_restore_drill');
    expect(drill.databaseRemoved).toBe(true);
    expect(drill.restoredEmail).toContain('@example.com');
    expect(drill.recovery.rpo).toBeNull();
    expect(drill.recovery.rto).toBeNull();

    const still = await pool.query<RowDataPacket[]>(`SELECT COUNT(*) AS n FROM schema_migrations`);
    expect(Number((still[0] as RowDataPacket[])[0]?.n)).toBeGreaterThan(0);
    const owner = await pool.query<RowDataPacket[]>(`SELECT email FROM users WHERE email = 'owner@example.com'`);
    expect((owner[0] as RowDataPacket[])[0]?.email).toBe('owner@example.com');
  }, 120_000);
});
