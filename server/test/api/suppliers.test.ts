import { createServer, type Server } from 'node:http';
import type { RowDataPacket } from 'mysql2';
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
      'farm_files', 'notifications', 'sale_returns', 'invoice_lines', 'invoice_documents', 'supplier_payments', 'supplier_bills', 'goods_receipts', 'purchase_order_lines', 'purchase_orders', 'suppliers',
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

describe('supplier workflows', () => {
  it('stores typed prices and receipts without posting stock or a tax rule', async () => {
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
    const supplier = await send(http, 'post', `/api/v1/farms/${farmId}/suppliers`, {
      name: 'Village feed shop', contactName: 'Kisan', phone: '', notes: '',
    });
    expect(supplier.status).toBe(201);
    const order = await send(http, 'post', `/api/v1/farms/${farmId}/purchase-orders`, {
      supplierId: supplier.body.data.id, orderedOn: today, notes: '',
      lines: [
        { description: 'broken rice', quantity: 10, unitLabel: 'kg', unitPrice: null, priceUnit: '' },
        { description: 'shell grit', quantity: 2, unitLabel: 'bag', unitPrice: 40, priceUnit: 'rupees typed' },
      ],
    });
    expect(order.status).toBe(201);
    expect(order.body.data.status).toBe('draft');
    const blank = order.body.data.lines.find((line: { description: string }) => line.description === 'broken rice');
    const priced = order.body.data.lines.find((line: { description: string }) => line.description === 'shell grit');
    expect(blank.unitPrice).toBeNull();
    expect(priced.unitPrice).toBe(40);
    expect(priced.priceUnit).toBe('rupees typed');

    const receipt = await send(http, 'post', `/api/v1/farms/${farmId}/goods-receipts`, {
      supplierId: supplier.body.data.id, purchaseOrderId: order.body.data.id, receivedOn: today,
      acceptedQuantity: 9, rejectedQuantity: 1, unitLabel: 'kg', note: 'One kilo was wet.',
    });
    expect(receipt.status).toBe(201);
    const [stock] = await pool.query<RowDataPacket[]>('SELECT COUNT(*) AS n FROM stock_movements');
    expect(Number(stock[0]?.n ?? stock)).toBe(0);

    const bill = await send(http, 'post', `/api/v1/farms/${farmId}/supplier-bills`, {
      supplierId: supplier.body.data.id, billedOn: today, amount: 80, unitLabel: 'rupees typed', referenceNote: 'slip 4', notes: '',
    });
    expect(bill.status).toBe(201);
    const payment = await send(http, 'post', `/api/v1/farms/${farmId}/supplier-payments`, {
      supplierId: supplier.body.data.id, paidOn: today, amount: 50, unitLabel: 'rupees typed', referenceNote: '', notes: 'Part of the slip.',
    });
    expect(payment.status).toBe(201);
    expect(payment.body.data).not.toHaveProperty('billId');

    const listed = await http.get(`/api/v1/farms/${farmId}/suppliers`);
    expect(listed.body.data.stockPosting).toBe('disabled');
    expect(listed.body.data.valuation).toEqual({ status: 'not_chosen', reason: 'decision 7 is open' });
    expect(JSON.stringify(listed.body)).not.toMatch(/gst|tax/i);

    const invited = await send(http, 'post', `/api/v1/farms/${farmId}/members`, {
      email: 'worker@example.com', displayName: 'Ravi Patil', password: 'worker-password-1', role: 'worker', permissionGrants: [],
    });
    expect(invited.status).toBe(201);
    const worker = agent();
    expect((await send(worker, 'post', '/api/v1/auth/login', { email: 'worker@example.com', password: 'worker-password-1' })).status).toBe(200);
    expect((await worker.get(`/api/v1/farms/${farmId}/suppliers`)).status).toBe(403);
  });
});
