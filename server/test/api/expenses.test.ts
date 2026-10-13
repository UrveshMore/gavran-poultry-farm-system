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
      'farm_files', 'notifications', 'sale_returns', 'invoice_lines', 'invoice_documents', 'supplier_payments', 'supplier_bills', 'goods_receipts', 'purchase_order_lines', 'purchase_orders', 'suppliers', 'parentage_records', 'task_training_requirements', 'training_completions', 'training_assignments', 'training_items', 'attendance_records', 'idempotency_keys',
      'audit_logs',
      'expense_entries',
      'expense_categories',
      'order_lines',
      'orders',
      'market_prices',
      'customers',
      'loss_incidents',
      'medicine_records',
      'health_observations',
      'biosecurity_steps',
      'knowledge_approvals',
      'growth_weighings',
      'growth_targets',
      'water_records',
      'stock_movements',
      'stock_items',
      'task_steps',
      'tasks',
      'task_template_steps',
      'task_templates',
      'hatch_records',
      'candling_lines',
      'candling_records',
      'incubation_batches',
      'incubator_readings',
      'incubator_maintenance',
      'incubators',
      'egg_collection_lines',
      'egg_collections',
      'egg_categories',
      'sex_counts', 'range_areas', 'batch_movements',
      'batches',
      'bird_types',
      'membership_permission_grants',
      'sheds',
      'farm_settings',
      'farm_memberships',
      'sessions',
      'password_reset_tokens',
      'farms',
      'users',
    ]) {
      await conn.query(`TRUNCATE TABLE \`${table}\``);
    }
    await conn.query('SET FOREIGN_KEY_CHECKS = 1');
  } finally {
    conn.release();
  }
  loginThrottle.reset();
});

describe('expenses without tax', () => {
  it('stores a typed amount, reverses it with a new row, and does not choose an accounting basis', async () => {
    const http = agent();
    const today = new Date().toISOString().slice(0, 10);
    expect((await send(http, 'post', '/api/v1/auth/register', {
      email: 'owner@example.com', password, displayName: 'Asha More', preferredLocale: 'en',
    })).status).toBe(201);
    const farm = await send(http, 'post', '/api/v1/farms', {
      name: 'Gavran Farm', code: 'HOME', timezone: 'UTC', locale: 'en', contactName: '', contactPhone: '',
      contactEmail: '', addressLine: '', weightUnit: 'kg', volumeUnit: 'L',
    });
    const farmId = farm.body.data.id as string;

    const first = await http.get(`/api/v1/farms/${farmId}/expenses`);
    expect(first.status).toBe(200);
    expect(first.body.data.categories).toEqual([]);
    expect(first.body.data.entries).toEqual([]);
    expect(first.body.data.accountingBasis).toEqual({ status: 'not_chosen', reason: 'decision 9 is open' });
    expect(JSON.stringify(first.body)).not.toMatch(/profit|gst|tax/i);

    const category = await send(http, 'post', `/api/v1/farms/${farmId}/expense-categories`, { name: 'Feed' });
    expect(category.status).toBe(201);
    const entry = await send(http, 'post', `/api/v1/farms/${farmId}/expenses`, {
      occurredOn: today,
      direction: 'expense',
      categoryId: category.body.data.id,
      amount: 450,
      unitLabel: 'rupees',
      counterparty: 'Village shop',
      referenceNote: '',
      notes: 'Broken maize',
      batchId: '',
    });
    expect(entry.status).toBe(201);
    expect(entry.body.data.amount).toBe(450);
    expect(entry.body.data.reversesEntryId).toBeNull();

    const edited = await send(http, 'patch', `/api/v1/farms/${farmId}/expenses/${entry.body.data.id}`, { amount: 1 });
    expect(edited.status).toBe(404);

    const reversal = await send(http, 'post', `/api/v1/farms/${farmId}/expenses/${entry.body.data.id}/reversal`, {
      occurredOn: today,
      note: 'The shop took the bag back.',
    });
    expect(reversal.status).toBe(201);
    expect(reversal.body.data.amount).toBe(450);
    expect(reversal.body.data.reversesEntryId).toBe(entry.body.data.id);
    expect(reversal.body.data.notes).toBe('The shop took the bag back.');

    const again = await send(http, 'post', `/api/v1/farms/${farmId}/expenses/${entry.body.data.id}/reversal`, {
      occurredOn: today,
      note: 'Second try',
    });
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe('ALREADY_REVERSED');

    const listed = await http.get(`/api/v1/farms/${farmId}/expenses`);
    const original = listed.body.data.entries.find((item: { id: string }) => item.id === entry.body.data.id);
    expect(original.amount).toBe(450);
    expect(original.notes).toBe('Broken maize');
    expect(original.reversedById).toBe(reversal.body.data.id);
    expect(listed.body.data).not.toHaveProperty('profit');

    const columns = await pool.query<RowDataPacket[]>(
      `SELECT column_name AS name FROM information_schema.columns
       WHERE table_schema = DATABASE()
         AND table_name IN ('expense_categories', 'expense_entries')
         AND (column_name LIKE '%tax%' OR column_name LIKE '%gst%')`,
    );
    expect(columns[0] as RowDataPacket[]).toEqual([]);

    expect((await send(http, 'post', `/api/v1/farms/${farmId}/members`, {
      email: 'worker@example.com', displayName: 'Ravi Patil', password: 'worker-password-1', role: 'worker', permissionGrants: [],
    })).status).toBe(201);
    const worker = agent();
    expect((await send(worker, 'post', '/api/v1/auth/login', { email: 'worker@example.com', password: 'worker-password-1' })).status).toBe(200);
    expect((await worker.get(`/api/v1/farms/${farmId}/expenses`)).status).toBe(403);
  });
});
