import { createServer, type Server } from 'node:http';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { pool } from '../../src/db/pool.js';
import { loginThrottle } from '../../src/modules/auth/service.js';

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
      'notifications',
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

describe('in-app notices', () => {
  it('stores a notice for a person and does not choose an urgent rule', async () => {
    const http = agent();
    const registered = await send(http, 'post', '/api/v1/auth/register', {
      email: 'owner@example.com', password, displayName: 'Asha More', preferredLocale: 'en',
    });
    const ownerId = registered.body.data.user.id as string;
    const farm = await send(http, 'post', '/api/v1/farms', {
      name: 'Gavran Farm', code: 'HOME', timezone: 'UTC', locale: 'en', contactName: '', contactPhone: '',
      contactEmail: '', addressLine: '', weightUnit: 'kg', volumeUnit: 'L',
    });
    const farmId = farm.body.data.id as string;
    const invited = await send(http, 'post', `/api/v1/farms/${farmId}/members`, {
      email: 'worker@example.com', displayName: 'Ravi Patil', password: 'worker-password-1', role: 'worker', permissionGrants: [],
    });
    const workerId = invited.body.data.member.userId as string;
    const saved = await send(http, 'post', `/api/v1/farms/${farmId}/notifications`, {
      userId: workerId, title: 'Close the gate', body: 'The hens are still in the yard.',
    });
    expect(saved.status).toBe(201);
    expect(saved.body.data.readAt).toBeNull();
    const listed = await http.get(`/api/v1/farms/${farmId}/notifications`);
    expect(listed.body.data.delivery).toBe('in_app');
    expect(listed.body.data.urgent).toEqual({ status: 'not_chosen', reason: 'decision 14 is open' });
    expect(JSON.stringify(listed.body)).not.toMatch(/sms|email|push/i);

    const worker = agent();
    expect((await send(worker, 'post', '/api/v1/auth/login', { email: 'worker@example.com', password: 'worker-password-1' })).status).toBe(200);
    expect((await send(worker, 'post', `/api/v1/farms/${farmId}/notifications`, { userId: ownerId, title: 'No', body: 'No' })).status).toBe(403);
    const mine = await worker.get(`/api/v1/farms/${farmId}/notifications`);
    expect(mine.body.data.notices).toHaveLength(1);
    const read = await send(worker, 'post', `/api/v1/farms/${farmId}/notifications/${saved.body.data.id}/read`, {});
    expect(read.status).toBe(200);
    expect(read.body.data.readAt).toEqual(expect.any(String));
  });
});
