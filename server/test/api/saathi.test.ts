import { createServer, type Server } from 'node:http';
import type { RowDataPacket } from 'mysql2/promise';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { pool } from '../../src/db/pool.js';
import { loginThrottle } from '../../src/modules/auth/service.js';

const app = createApp();
let server: Server;
const password = 'correct-horse-battery';
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

beforeAll(async () => {
  server = createServer(app);
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
});

function agent() {
  return request.agent(server);
}

type Http = ReturnType<typeof agent>;

async function csrf(http: Http): Promise<string> {
  const res = await http.get('/api/v1/auth/csrf');
  return res.body.data.csrfToken as string;
}

async function send(http: Http, method: 'post' | 'patch' | 'put', path: string, body: object, headers: Record<string, string> = {}) {
  const token = await csrf(http);
  const req = http[method](path).set('X-CSRF-Token', token);
  for (const [key, value] of Object.entries(headers)) req.set(key, value);
  return req.send(body);
}

async function truncate(): Promise<void> {
  const conn = await pool.getConnection();
  try {
    await conn.query('SET FOREIGN_KEY_CHECKS = 0');
    for (const table of [
      'saathi_photos', 'farm_ai_keys', 'batch_dose_marks', 'medicine_photos', 'farm_schedule_approvals', 'yard_notes', 'report_schedules', 'farm_files', 'notifications', 'sale_returns', 'invoice_lines', 'invoice_documents', 'supplier_payments', 'supplier_bills', 'goods_receipts', 'purchase_order_lines', 'purchase_orders', 'suppliers', 'parentage_records', 'task_training_requirements', 'training_completions', 'training_assignments', 'training_items', 'attendance_records', 'idempotency_keys',
      'audit_logs', 'expense_entries', 'expense_categories', 'order_lines', 'orders', 'market_prices', 'customers', 'loss_incidents', 'medicine_records', 'health_observations', 'biosecurity_steps', 'knowledge_approvals', 'growth_weighings', 'growth_targets', 'water_records', 'stock_movements', 'stock_items', 'task_steps', 'tasks', 'task_template_steps', 'task_templates', 'hatch_records', 'candling_lines', 'candling_records', 'incubation_batches', 'incubator_readings', 'incubator_maintenance', 'incubators', 'egg_collection_lines', 'egg_collections', 'egg_categories', 'sex_counts', 'range_areas', 'batch_movements', 'batches', 'bird_types', 'membership_permission_grants', 'sheds', 'farm_settings', 'farm_memberships', 'sessions', 'password_reset_tokens', 'farms', 'users',
    ]) {
      await conn.query(`TRUNCATE TABLE \`${table}\``);
    }
    await conn.query('SET FOREIGN_KEY_CHECKS = 1');
  } finally {
    conn.release();
  }
  loginThrottle.reset();
}

beforeEach(truncate);

async function ownerFarm() {
  const http = agent();
  const registered = await send(http, 'post', '/api/v1/auth/register', {
    email: 'owner@example.com',
    password,
    displayName: 'Asha More',
    preferredLocale: 'en',
  });
  expect(registered.status).toBe(201);
  const farm = await send(http, 'post', '/api/v1/farms', {
    name: 'Gavran Farm',
    code: 'HOME',
    timezone: 'UTC',
    locale: 'en',
    contactName: '',
    contactPhone: '',
    contactEmail: '',
    addressLine: '',
    weightUnit: 'kg',
    volumeUnit: 'L',
  });
  expect(farm.status).toBe(201);
  const farmId = farm.body.data.id as string;
  expect((await send(http, 'post', `/api/v1/farms/${farmId}/egg-categories`, { name: 'Table' })).status).toBe(201);
  return { http, farmId };
}

describe('saathi confirm before save', () => {
  it('turns a voice transcript into a card and writes the eggs only after Save', async () => {
    const { http, farmId } = await ownerFarm();
    const draft = await send(http, 'post', `/api/v1/farms/${farmId}/saathi/propose`, { text: 'collected 12 eggs today', source: 'voice' });
    expect(draft.status).toBe(200);
    expect(draft.body.data.type).toBe('confirm');
    expect(draft.body.data.card.action).toBe('eggs');
    expect(draft.body.data.saved).toBeUndefined();
    const before = await pool.query<RowDataPacket[]>('SELECT COUNT(*) AS n FROM egg_collections');
    expect(Number((before[0] as RowDataPacket[])[0]?.n)).toBe(0);

    const saved = await send(http, 'post', `/api/v1/farms/${farmId}/saathi/commit`, draft.body.data.card, { 'Idempotency-Key': 'saathi-eggs-1' });
    expect(saved.status).toBe(201);
    expect(saved.body.data.total).toBe(12);
    const after = await pool.query<RowDataPacket[]>('SELECT COUNT(*) AS n FROM egg_collections');
    expect(Number((after[0] as RowDataPacket[])[0]?.n)).toBe(1);
  });

  it('stores the Gemini key encrypted and keeps a photo correction off the egg book', async () => {
    const { http, farmId } = await ownerFarm();
    const secret = 'test-key-not-a-real-gemini-secret';
    const put = await send(http, 'put', `/api/v1/farms/${farmId}/saathi/key`, { apiKey: secret });
    expect(put.status).toBe(200);
    expect(put.body.data.hint).toBe('cret');
    expect(JSON.stringify(put.body)).not.toContain(secret);
    const row = await pool.query<RowDataPacket[]>('SELECT cipher_text FROM farm_ai_keys WHERE farm_id = ?', [farmId]);
    expect(String((row[0] as RowDataPacket[])[0]?.cipher_text)).not.toContain(secret);

    const token = await csrf(http);
    const photo = await http.post(`/api/v1/farms/${farmId}/saathi/photos`).set('X-CSRF-Token', token).attach('file', png, { filename: 'eggs.png', contentType: 'image/png' }).field('kind', 'eggs');
    expect(photo.status).toBe(201);
    expect(photo.body.data.saved).toBe(false);
    expect(photo.body.data.ai.unavailable).toBe(true);
    const corrected = await send(http, 'patch', `/api/v1/farms/${farmId}/saathi/photos/${photo.body.data.id}`, { count: 29, note: 'I counted 29' });
    expect(corrected.status).toBe(200);
    expect(corrected.body.data.saved).toBe(false);
    expect(corrected.body.data.correction.count).toBe(29);
    const eggs = await pool.query<RowDataPacket[]>('SELECT COUNT(*) AS n FROM egg_collections');
    expect(Number((eggs[0] as RowDataPacket[])[0]?.n)).toBe(0);
  });
});
