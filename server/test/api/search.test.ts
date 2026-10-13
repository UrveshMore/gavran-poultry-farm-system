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

describe('farm search', () => {
  it('escapes wildcards and hides supplier and expense rows from a worker', async () => {
    const http = agent();
    await send(http, 'post', '/api/v1/auth/register', {
      email: 'owner@example.com', password, displayName: 'Asha More', preferredLocale: 'en',
    });
    const farm = await send(http, 'post', '/api/v1/farms', {
      name: 'Gavran Farm', code: 'HOME', timezone: 'UTC', locale: 'en', contactName: '', contactPhone: '',
      contactEmail: '', addressLine: '', weightUnit: 'kg', volumeUnit: 'L',
    });
    const farmId = farm.body.data.id as string;
    const other = await send(http, 'post', '/api/v1/farms', {
      name: 'Other Farm', code: 'AWAY', timezone: 'UTC', locale: 'en', contactName: '', contactPhone: '',
      contactEmail: '', addressLine: '', weightUnit: 'kg', volumeUnit: 'L',
    });
    await send(http, 'post', `/api/v1/farms/${farmId}/members`, {
      email: 'worker@example.com', displayName: 'Ravi Patil', password: 'worker-password-1', role: 'worker', permissionGrants: [],
    });
    expect((await send(http, 'post', `/api/v1/farms/${farmId}/sheds`, {
      code: 'P1', name: 'A%B Gate', shedType: 'other', usableCapacity: 10, status: 'active', notes: '',
    })).status).toBe(201);
    expect((await send(http, 'post', `/api/v1/farms/${farmId}/sheds`, {
      code: 'X1', name: 'AXB Gate', shedType: 'other', usableCapacity: 10, status: 'active', notes: '',
    })).status).toBe(201);
    expect((await send(http, 'post', `/api/v1/farms/${other.body.data.id}/sheds`, {
      code: 'P2', name: 'A%B Other', shedType: 'other', usableCapacity: 10, status: 'active', notes: '',
    })).status).toBe(201);
    expect((await send(http, 'post', `/api/v1/farms/${farmId}/suppliers`, {
      name: 'Hidden Mill', contactName: '', phone: '', notes: '',
    })).status).toBe(201);
    const category = await send(http, 'post', `/api/v1/farms/${farmId}/expense-categories`, { name: 'Feed' });
    const today = new Date().toISOString().slice(0, 10);
    expect((await send(http, 'post', `/api/v1/farms/${farmId}/expenses`, {
      occurredOn: today, direction: 'expense', categoryId: category.body.data.id, amount: 80, unitLabel: 'typed',
      counterparty: 'secret slip', referenceNote: '', notes: 'yard', batchId: '',
    })).status).toBe(201);

    const short = await http.get(`/api/v1/farms/${farmId}/search`).query({ q: 'A' });
    expect(short.status).toBe(422);
    expect(short.body.error.details.fields.q).toBe('too_small');

    const sheds = await http.get(`/api/v1/farms/${farmId}/search`).query({ q: 'A%' });
    expect(sheds.status).toBe(200);
    expect(sheds.body.data.hits.map((hit: { label: string }) => hit.label)).toEqual(['A%B Gate']);

    const money = await http.get(`/api/v1/farms/${farmId}/search`).query({ q: 'secret' });
    expect(money.body.data.hits).toEqual([{ kind: 'expense', id: expect.any(String), label: 'secret slip yard' }]);
    expect(JSON.stringify(money.body)).not.toMatch(/unitPrice|"amount"|gst/i);

    const supplier = await http.get(`/api/v1/farms/${farmId}/search`).query({ q: 'Hidden' });
    expect(supplier.body.data.hits.map((hit: { kind: string }) => hit.kind)).toEqual(['supplier']);

    const worker = agent();
    expect((await send(worker, 'post', '/api/v1/auth/login', { email: 'worker@example.com', password: 'worker-password-1' })).status).toBe(200);
    const hidden = await worker.get(`/api/v1/farms/${farmId}/search`).query({ q: 'secret' });
    expect(hidden.status).toBe(200);
    expect(hidden.body.data.hits).toEqual([]);
    const mills = await worker.get(`/api/v1/farms/${farmId}/search`).query({ q: 'Hidden' });
    expect(mills.body.data.hits).toEqual([]);
    const gates = await worker.get(`/api/v1/farms/${farmId}/search`).query({ q: 'A%' });
    expect(gates.body.data.hits.map((hit: { label: string }) => hit.label)).toEqual(['A%B Gate']);
  });
});
