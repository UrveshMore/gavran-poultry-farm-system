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
      'report_schedules', 'farm_files', 'notifications', 'sale_returns', 'invoice_lines', 'invoice_documents',
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
    ]) {
      await conn.query(`TRUNCATE TABLE \`${table}\``);
    }
    await conn.query('SET FOREIGN_KEY_CHECKS = 1');
  } finally {
    conn.release();
  }
  loginThrottle.reset();
});

describe('invoice documents', () => {
  it('stores an unposted document and a return row, and still refuses posting', async () => {
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
    const customer = await send(http, 'post', `/api/v1/farms/${farmId}/customers`, { name: 'Meera Kulkarni', phone: '', notes: '' });
    const doc = await send(http, 'post', `/api/v1/farms/${farmId}/invoice-documents`, {
      customerId: customer.body.data.id, orderId: '', issuedOn: today, notes: 'Handed over at the gate.',
      lines: [{ description: 'table eggs', quantity: 2, unitLabel: 'dozen', unitPrice: 180, priceUnit: 'rupees typed' }],
    });
    expect(doc.status).toBe(201);
    expect(doc.body.data.status).toBe('unposted');
    const returned = await send(http, 'post', `/api/v1/farms/${farmId}/invoice-documents/${doc.body.data.id}/returns`, {
      returnedOn: today, description: 'one cracked dozen', quantity: 1, amount: 180, unitLabel: 'rupees typed', note: 'Brought back the same day.',
    });
    expect(returned.status).toBe(201);
    const listed = await http.get(`/api/v1/farms/${farmId}/invoice-documents`);
    expect(listed.body.data.documents).toHaveLength(1);
    expect(listed.body.data.returns).toHaveLength(1);
    expect(listed.body.data.posting).toBe('disabled');
    expect(listed.body.data.balance).toEqual({ status: 'not_calculated', reason: 'decision 9 is open' });
    expect(JSON.stringify(listed.body)).not.toMatch(/gst|profit|outstanding/i);
    const posting = await send(http, 'post', `/api/v1/farms/${farmId}/invoices`, {});
    expect(posting.status).toBe(409);
    expect(posting.body.error.code).toBe('INVOICE_POSTING_DISABLED');
  });
});
