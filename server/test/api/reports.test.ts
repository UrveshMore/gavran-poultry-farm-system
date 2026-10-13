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
      'report_schedules', 'farm_files', 'notifications', 'sale_returns', 'invoice_lines', 'invoice_documents', 'supplier_payments', 'supplier_bills', 'goods_receipts', 'purchase_order_lines', 'purchase_orders', 'suppliers', 'parentage_records', 'task_training_requirements', 'training_completions', 'training_assignments', 'training_items', 'attendance_records', 'idempotency_keys', 'audit_logs', 'expense_entries', 'expense_categories', 'order_lines', 'orders', 'market_prices', 'customers',
      'loss_incidents', 'medicine_records', 'health_observations', 'biosecurity_steps', 'knowledge_approvals',
      'growth_weighings', 'growth_targets', 'water_records', 'stock_movements', 'stock_items',
      'task_steps', 'tasks', 'task_template_steps', 'task_templates', 'hatch_records', 'candling_lines', 'candling_records',
      'incubation_batches', 'incubator_readings', 'incubator_maintenance', 'incubators',
      'egg_collection_lines', 'egg_collections', 'egg_categories', 'sex_counts', 'range_areas', 'batch_movements', 'batches', 'bird_types',
      'membership_permission_grants', 'sheds', 'farm_settings', 'farm_memberships', 'sessions', 'password_reset_tokens', 'farms', 'users',
    ]) {
      await conn.query(`TRUNCATE TABLE \`${table}\``);
    }
    await conn.query('SET FOREIGN_KEY_CHECKS = 1');
  } finally {
    conn.release();
  }
  loginThrottle.reset();
});

describe('essential reports', () => {
  it('shows the date range and source rows, and does not treat an open formula as official', async () => {
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
    const category = await send(http, 'post', `/api/v1/farms/${farmId}/egg-categories`, { name: 'Table' });
    expect((await send(http, 'post', `/api/v1/farms/${farmId}/eggs`, {
      collectedOn: today, batchId: '', shedId: '', shiftLabel: '', notes: '',
      lines: [{ categoryId: category.body.data.id, eggCount: 4 }],
    })).status).toBe(201);
    expect((await send(http, 'post', `/api/v1/farms/${farmId}/losses`, {
      occurredOn: today, birdCount: 1, note: 'A dog came into the yard at dusk.', movementId: '',
    })).status).toBe(201);
    const expenseCategory = await send(http, 'post', `/api/v1/farms/${farmId}/expense-categories`, { name: 'Feed' });
    expect((await send(http, 'post', `/api/v1/farms/${farmId}/expenses`, {
      occurredOn: today, direction: 'expense', categoryId: expenseCategory.body.data.id, amount: 450, unitLabel: 'rupees',
      counterparty: '', referenceNote: '', notes: '', batchId: '',
    })).status).toBe(201);

    const missing = await http.get(`/api/v1/farms/${farmId}/reports`);
    expect(missing.status).toBe(422);
    const backwards = await http.get(`/api/v1/farms/${farmId}/reports?from=${today}&to=2020-01-01`);
    expect(backwards.status).toBe(422);

    const report = await http.get(`/api/v1/farms/${farmId}/reports?from=${today}&to=${today}`);
    expect(report.status).toBe(200);
    expect(report.body.data.from).toBe(today);
    expect(report.body.data.to).toBe(today);
    expect(typeof report.body.data.generatedAt).toBe('string');
    expect(report.body.data.offlinePending).toBe('none');
    const eggs = report.body.data.sections.find((section: { id: string }) => section.id === 'eggs');
    expect(eggs.total).toBe(4);
    expect(eggs.rows).toHaveLength(1);
    expect(eggs.formula.status).toBe('sum');
    const hatches = report.body.data.sections.find((section: { id: string }) => section.id === 'hatches');
    expect(hatches.formula).toEqual({ status: 'proposed', text: 'live chicks ÷ eggs set × 100' });
    expect(hatches.rows).toEqual([]);
    const losses = report.body.data.sections.find((section: { id: string }) => section.id === 'losses');
    expect(losses.formula).toEqual({ status: 'not_calculated', reason: 'decision 4 is open' });
    expect(losses.rows[0].note).toBe('A dog came into the yard at dusk.');
    expect(losses).not.toHaveProperty('percent');
    const expenses = report.body.data.sections.find((section: { id: string }) => section.id === 'expenses');
    expect(expenses.formula.status).toBe('not_chosen');
    expect(expenses.listedSums).toEqual([{ direction: 'expense', unitLabel: 'rupees', amount: 450 }]);
    expect(JSON.stringify(report.body)).not.toMatch(/fcr|profit|gst/i);
    expect(report.body.data.sections.find((section: { id: string }) => section.id === 'attendance').formula.status).toBe('row_count');
    const filtered = await http.get(`/api/v1/farms/${farmId}/reports?from=${today}&to=${today}&categoryId=${category.body.data.id}`);
    expect(filtered.body.data.sections.find((section: { id: string }) => section.id === 'eggs').total).toBe(4);
    expect(filtered.body.data.sections.find((section: { id: string }) => section.id === 'expenses').rows).toEqual([]);
    const exported = await http.get(`/api/v1/farms/${farmId}/reports/export?from=${today}&to=${today}&categoryId=${category.body.data.id}`);
    expect(exported.status).toBe(200);
    expect(exported.headers['content-disposition']).toContain('gavran-report.json');
    expect(exported.body.data.filters.categoryId).toBe(category.body.data.id);
    expect(exported.body.data.sections.find((section: { id: string }) => section.id === 'eggs').total).toBe(filtered.body.data.sections.find((section: { id: string }) => section.id === 'eggs').total);

    const empty = await http.get(`/api/v1/farms/${farmId}/reports?from=2020-01-01&to=2020-01-02`);
    expect(empty.body.data.sections.find((section: { id: string }) => section.id === 'eggs').total).toBe(0);
    expect(empty.body.data.sections.find((section: { id: string }) => section.id === 'eggs').formula.status).toBe('sum');

    expect((await send(http, 'post', `/api/v1/farms/${farmId}/members`, {
      email: 'worker@example.com', displayName: 'Ravi Patil', password: 'worker-password-1', role: 'worker', permissionGrants: [],
    })).status).toBe(201);
    const worker = agent();
    expect((await send(worker, 'post', '/api/v1/auth/login', { email: 'worker@example.com', password: 'worker-password-1' })).status).toBe(200);
    expect((await worker.get(`/api/v1/farms/${farmId}/reports?from=${today}&to=${today}`)).status).toBe(403);
  });
});
