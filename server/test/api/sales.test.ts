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
      'notifications', 'sale_returns', 'invoice_lines', 'invoice_documents', 'supplier_payments', 'supplier_bills', 'goods_receipts', 'purchase_order_lines', 'purchase_orders', 'suppliers', 'parentage_records', 'task_training_requirements', 'training_completions', 'training_assignments', 'training_items', 'attendance_records', 'idempotency_keys',
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

describe('sales the owner types', () => {
  it('starts with an empty price list, stores a typed rate, keeps orders as drafts, and refuses invoices', async () => {
    const http = agent();
    const today = new Date().toISOString().slice(0, 10);
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
    const farmId = farm.body.data.id as string;

    const prices = await http.get(`/api/v1/farms/${farmId}/market-prices`);
    expect(prices.status).toBe(200);
    expect(prices.body.data).toEqual([]);
    const seeded = await pool.query<RowDataPacket[]>(`SELECT COUNT(*) AS n FROM market_prices`);
    expect(Number((seeded[0] as RowDataPacket[])[0]?.n)).toBe(0);

    const price = await send(http, 'post', `/api/v1/farms/${farmId}/market-prices`, {
      itemName: 'Table eggs',
      amount: 180,
      unitLabel: 'per dozen',
      effectiveOn: today,
    });
    expect(price.status).toBe(201);
    expect(price.body.data.amount).toBe(180);
    expect(price.body.data.unitLabel).toBe('per dozen');

    const customer = await send(http, 'post', `/api/v1/farms/${farmId}/customers`, {
      name: 'Meera Kulkarni',
      phone: '',
      notes: '',
    });
    expect(customer.status).toBe(201);
    const duplicate = await send(http, 'post', `/api/v1/farms/${farmId}/customers`, {
      name: 'Meera Kulkarni',
      phone: '',
      notes: '',
    });
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error.code).toBe('DUPLICATE_CODE');

    const order = await send(http, 'post', `/api/v1/farms/${farmId}/orders`, {
      customerId: customer.body.data.id,
      orderedOn: today,
      lines: [{ description: 'Table eggs', quantity: 2, unitPrice: 180 }],
    });
    expect(order.status).toBe(201);
    expect(order.body.data.status).toBe('draft');
    expect(order.body.data.lines).toEqual([{ description: 'Table eggs', quantity: 2, unitPrice: 180 }]);

    const listed = await http.get(`/api/v1/farms/${farmId}/orders`);
    expect(listed.body.data.invoicePosting).toBe('disabled');
    expect(listed.body.data.orders).toHaveLength(1);

    const invoice = await send(http, 'post', `/api/v1/farms/${farmId}/invoices`, {});
    expect(invoice.status).toBe(409);
    expect(invoice.body.error.code).toBe('INVOICE_POSTING_DISABLED');

    const columns = await pool.query<RowDataPacket[]>(
      `SELECT column_name AS name FROM information_schema.columns
       WHERE table_schema = DATABASE()
         AND table_name IN ('customers', 'market_prices', 'orders', 'order_lines')
         AND (column_name LIKE '%tax%' OR column_name LIKE '%gst%')`,
    );
    expect(columns[0] as RowDataPacket[]).toEqual([]);
    const status = await pool.query<RowDataPacket[]>(
      `SELECT column_type AS kind FROM information_schema.columns
       WHERE table_schema = DATABASE() AND table_name = 'orders' AND column_name = 'status'`,
    );
    expect(String((status[0] as RowDataPacket[])[0]?.kind)).toBe("enum('draft')");

    const workerInvite = await send(http, 'post', `/api/v1/farms/${farmId}/members`, {
      email: 'worker@example.com',
      displayName: 'Ravi Patil',
      password: 'worker-password-1',
      role: 'worker',
      permissionGrants: [],
    });
    expect(workerInvite.status).toBe(201);
    const worker = agent();
    expect((await send(worker, 'post', '/api/v1/auth/login', { email: 'worker@example.com', password: 'worker-password-1' })).status).toBe(200);
    const blocked = await send(worker, 'post', `/api/v1/farms/${farmId}/customers`, { name: 'Side buyer', phone: '', notes: '' });
    expect(blocked.status).toBe(403);
    expect((await worker.get(`/api/v1/farms/${farmId}/market-prices`)).status).toBe(403);
  });
});
