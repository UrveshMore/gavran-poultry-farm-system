import { createServer, type Server } from 'node:http';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { pool } from '../../src/db/pool.js';
import { loginThrottle } from '../../src/modules/auth/service.js';

const app = createApp();
let server: Server;
const password = 'correct-horse-battery';
const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

beforeAll(async () => {
  server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
});
afterAll(async () => {
  await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
});

function agent() { return request.agent(server); }
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
      'report_schedules', 'farm_files', 'notifications',
      'sale_returns', 'invoice_lines', 'invoice_documents',
      'supplier_payments', 'supplier_bills', 'goods_receipts', 'purchase_order_lines', 'purchase_orders', 'suppliers',
      'parentage_records',
      'task_training_requirements', 'training_completions', 'training_assignments', 'training_items', 'attendance_records',
      'idempotency_keys', 'audit_logs', 'expense_entries', 'expense_categories', 'order_lines', 'orders', 'market_prices', 'customers',
      'loss_incidents', 'medicine_records', 'health_observations', 'biosecurity_steps', 'knowledge_approvals',
      'growth_weighings', 'growth_targets', 'water_records', 'stock_movements', 'stock_items',
      'task_steps', 'tasks', 'task_template_steps', 'task_templates', 'hatch_records', 'candling_lines', 'candling_records',
      'incubation_batches', 'incubator_readings', 'incubator_maintenance', 'incubators',
      'egg_collection_lines', 'egg_collections', 'egg_categories', 'sex_counts', 'range_areas', 'batch_movements', 'batches', 'bird_types',
      'membership_permission_grants', 'sheds', 'farm_settings', 'farm_memberships', 'sessions', 'password_reset_tokens', 'farms', 'users',
    ]) await conn.query(`TRUNCATE TABLE \`${table}\``);
    await conn.query('SET FOREIGN_KEY_CHECKS = 1');
  } finally { conn.release(); }
  loginThrottle.reset();
});

describe('farm files', () => {
  it('stores a photo, refuses other bytes, and does not claim a scan or a retention period', async () => {
    const http = agent();
    await send(http, 'post', '/api/v1/auth/register', {
      email: 'owner@example.com', password, displayName: 'Asha More', preferredLocale: 'en',
    });
    const farm = await send(http, 'post', '/api/v1/farms', {
      name: 'Gavran Farm', code: 'HOME', timezone: 'UTC', locale: 'en', contactName: '', contactPhone: '',
      contactEmail: '', addressLine: '', weightUnit: 'kg', volumeUnit: 'L',
    });
    const farmId = farm.body.data.id as string;
    await send(http, 'post', `/api/v1/farms/${farmId}/members`, {
      email: 'worker@example.com', displayName: 'Ravi Patil', password: 'worker-password-1', role: 'worker', permissionGrants: [],
    });

    const token = await csrf(http);
    const saved = await http
      .post(`/api/v1/farms/${farmId}/documents`)
      .set('X-CSRF-Token', token)
      .set('Idempotency-Key', 'doc-yard-photo-1')
      .attach('file', png, { filename: 'yard.png', contentType: 'image/png' })
      .field('note', 'yard gate');
    expect(saved.status).toBe(201);
    expect(saved.body.data.originalName).toBe('yard.png');
    expect(saved.body.data.note).toBe('yard gate');

    const replayToken = await csrf(http);
    const replay = await http
      .post(`/api/v1/farms/${farmId}/documents`)
      .set('X-CSRF-Token', replayToken)
      .set('Idempotency-Key', 'doc-yard-photo-1')
      .attach('file', png, { filename: 'yard.png', contentType: 'image/png' })
      .field('note', 'yard gate');
    expect(replay.status).toBe(201);
    expect(replay.body.data.id).toBe(saved.body.data.id);

    const textToken = await csrf(http);
    const text = await http
      .post(`/api/v1/farms/${farmId}/documents`)
      .set('X-CSRF-Token', textToken)
      .attach('file', Buffer.from('not a picture'), { filename: 'note.txt', contentType: 'text/plain' })
      .field('note', 'no');
    expect(text.status).toBe(422);
    expect(text.body.error.details.fields.file).toBe('invalid_format');

    const listed = await http.get(`/api/v1/farms/${farmId}/documents`);
    expect(listed.body.data.files).toHaveLength(1);
    expect(listed.body.data.scan).toEqual({ status: 'not_claimed' });
    expect(listed.body.data.retention).toEqual({ status: 'not_chosen', reason: 'decision 15 is open' });
    expect(JSON.stringify(listed.body)).not.toMatch(/virus|malware|scanned/i);

    const opened = await http.get(`/api/v1/farms/${farmId}/documents/${saved.body.data.id}/file`).buffer(true);
    expect(opened.status).toBe(200);
    expect(opened.headers['content-type']).toBe('image/png');
    expect(opened.headers['x-content-type-options']).toBe('nosniff');
    expect(Buffer.compare(opened.body as Buffer, png)).toBe(0);

    const deleteToken = await csrf(http);
    expect((await http.delete(`/api/v1/farms/${farmId}/documents/${saved.body.data.id}`).set('X-CSRF-Token', deleteToken)).status).toBe(404);
    expect((await http.get(`/api/v1/farms/${farmId}/documents`)).body.data.files).toHaveLength(1);

    const worker = agent();
    expect((await send(worker, 'post', '/api/v1/auth/login', { email: 'worker@example.com', password: 'worker-password-1' })).status).toBe(200);
    expect((await worker.get(`/api/v1/farms/${farmId}/documents`)).status).toBe(403);
  });
});
