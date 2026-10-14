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
      'yard_notes', 'report_schedules', 'farm_files', 'notifications',
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
  } finally {
    conn.release();
  }
  loginThrottle.reset();
});

describe('yard notes', () => {
  it('stores a let-out and a shut-in without suggesting a clock time', async () => {
    const http = agent();
    const today = new Date().toISOString().slice(0, 10);
    const registered = await send(http, 'post', '/api/v1/auth/register', {
      email: 'owner@example.com', password, displayName: 'Asha More', preferredLocale: 'en',
    });
    expect(registered.status).toBe(201);
    const farm = await send(http, 'post', '/api/v1/farms', {
      name: 'Gavran Farm', code: 'HOME', timezone: 'UTC', locale: 'en', contactName: '', contactPhone: '',
      contactEmail: '', addressLine: '', weightUnit: 'kg', volumeUnit: 'L',
    });
    const farmId = farm.body.data.id as string;
    const future = await send(http, 'post', `/api/v1/farms/${farmId}/yard-notes`, {
      notedOn: '2099-01-01', kind: 'let_out', notedTime: '06:30', body: 'Hens out under the mango tree.',
    });
    expect(future.status).toBe(422);
    expect(future.body.error.details.fields.notedOn).toBe('future_date');

    const saved = await send(http, 'post', `/api/v1/farms/${farmId}/yard-notes`, {
      notedOn: today, kind: 'let_out', notedTime: '06:30', body: 'Hens out under the mango tree.',
    });
    expect(saved.status).toBe(201);
    expect(saved.body.data.kind).toBe('let_out');
    expect(saved.body.data.notedTime).toBe('06:30');
    expect(JSON.stringify(saved.body)).not.toMatch(/recommend|predator|dose/i);

    const invited = await send(http, 'post', `/api/v1/farms/${farmId}/members`, {
      email: 'worker@example.com', displayName: 'Ravi Patil', password: 'worker-password-1', role: 'worker', permissionGrants: [],
    });
    expect(invited.status).toBe(201);
    const worker = agent();
    const workerLogin = await send(worker, 'post', '/api/v1/auth/login', { email: 'worker@example.com', password: 'worker-password-1' });
    expect(workerLogin.status).toBe(200);
    const shut = await send(worker, 'post', `/api/v1/farms/${farmId}/yard-notes`, {
      notedOn: today, kind: 'shut_in', notedTime: '', body: 'All birds shut. One hen stayed on the nest.',
    });
    expect(shut.status).toBe(201);

    const listed = await http.get(`/api/v1/farms/${farmId}/yard-notes`);
    expect(listed.status).toBe(200);
    expect(listed.body.data.notes).toHaveLength(2);
    expect(listed.body.data.notes.map((item: { kind: string }) => item.kind).sort()).toEqual(['let_out', 'shut_in']);
  });
});
