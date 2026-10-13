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

async function send(http: Http, method: 'post' | 'patch', path: string, body: object) {
  const token = await csrf(http);
  return http[method](path).set('X-CSRF-Token', token).send(body);
}

async function truncate(): Promise<void> {
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
}

beforeEach(truncate);

describe('stock, water, and growth', () => {
  it('keeps quantities without a stock value and uses only weights the farm types', async () => {
    const http = agent();
    const today = new Date().toISOString().slice(0, 10);
    expect((await send(http, 'post', '/api/v1/auth/register', {
      email: 'owner@example.com',
      password,
      displayName: 'Asha More',
      preferredLocale: 'en',
    })).status).toBe(201);
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
    const shed = await send(http, 'post', `/api/v1/farms/${farmId}/sheds`, {
      code: 'A1',
      name: 'Yard',
      shedType: 'other',
      usableCapacity: 40,
      status: 'active',
      notes: '',
    });
    const bird = await send(http, 'post', `/api/v1/farms/${farmId}/bird-types`, { name: 'Desi' });
    const batch = await send(http, 'post', `/api/v1/farms/${farmId}/batches`, {
      code: 'D1',
      birdTypeId: bird.body.data.id,
      sourceNote: '',
      hatchDate: '',
      openedOn: today,
      shedId: shed.body.data.id,
      birdCount: 12,
    });
    expect(batch.status).toBe(201);

    const columns = await pool.query<RowDataPacket[]>(
      `SELECT column_name AS name FROM information_schema.columns
       WHERE table_schema = DATABASE() AND (column_name LIKE '%fcr%' OR column_name LIKE '%valuation%' OR column_name = 'standard_weight')`,
    );
    expect(columns[0] as RowDataPacket[]).toEqual([]);

    const item = await send(http, 'post', `/api/v1/farms/${farmId}/stock-items`, {
      name: 'Broken maize',
      unitLabel: 'kg',
      reorderLevel: 8,
      notes: '',
    });
    expect(item.status).toBe(201);
    expect(item.body.data.onHand).toBe(0);
    expect(item.body.data).not.toHaveProperty('value');

    const receipt = await send(http, 'post', `/api/v1/farms/${farmId}/stock-movements`, {
      itemId: item.body.data.id,
      movementType: 'receipt',
      direction: 'in',
      quantity: 10,
      occurredOn: today,
      batchId: '',
      shedId: '',
      lotCode: '',
      expiresOn: '',
      unitCost: null,
      supplierName: '',
      reason: '',
    });
    expect(receipt.status).toBe(201);
    expect(receipt.body.data.unitCost).toBeNull();

    const priced = await send(http, 'post', `/api/v1/farms/${farmId}/stock-movements`, {
      itemId: item.body.data.id,
      movementType: 'use',
      direction: 'out',
      quantity: 1,
      occurredOn: today,
      batchId: batch.body.data.id,
      shedId: '',
      lotCode: '',
      expiresOn: '',
      unitCost: 40,
      supplierName: '',
      reason: '',
    });
    expect(priced.status).toBe(422);
    expect(priced.body.error.details.fields.unitCost).toBe('invalid_format');

    const tooMuch = await send(http, 'post', `/api/v1/farms/${farmId}/stock-movements`, {
      itemId: item.body.data.id,
      movementType: 'use',
      direction: 'out',
      quantity: 12,
      occurredOn: today,
      batchId: '',
      shedId: '',
      lotCode: '',
      expiresOn: '',
      unitCost: null,
      supplierName: '',
      reason: '',
    });
    expect(tooMuch.status).toBe(409);
    expect(tooMuch.body.error.code).toBe('INSUFFICIENT_STOCK');

    const used = await send(http, 'post', `/api/v1/farms/${farmId}/stock-movements`, {
      itemId: item.body.data.id,
      movementType: 'use',
      direction: 'out',
      quantity: 4,
      occurredOn: today,
      batchId: '',
      shedId: '',
      lotCode: '',
      expiresOn: '',
      unitCost: null,
      supplierName: '',
      reason: '',
    });
    expect(used.status).toBe(201);
    const bareReversal = await send(http, 'post', `/api/v1/farms/${farmId}/stock-movements`, {
      itemId: item.body.data.id,
      movementType: 'reversal',
      direction: 'in',
      quantity: 1,
      occurredOn: today,
      batchId: '',
      shedId: '',
      lotCode: '',
      expiresOn: '',
      unitCost: null,
      supplierName: '',
      reason: '',
    });
    expect(bareReversal.status).toBe(422);
    const reversal = await send(http, 'post', `/api/v1/farms/${farmId}/stock-movements`, {
      itemId: item.body.data.id,
      movementType: 'reversal',
      direction: 'in',
      quantity: 1,
      occurredOn: today,
      batchId: '',
      shedId: '',
      lotCode: '',
      expiresOn: '',
      unitCost: null,
      supplierName: '',
      reason: 'Put back a bag that was counted twice',
    });
    expect(reversal.status).toBe(201);

    const items = await http.get(`/api/v1/farms/${farmId}/stock-items`);
    expect(items.body.data[0].onHand).toBe(7);
    expect(items.body.data[0].belowReorder).toBe(true);
    expect(JSON.stringify(items.body)).not.toMatch(/fcr|valuation|standardWeight/i);

    const water = await send(http, 'post', `/api/v1/farms/${farmId}/water`, {
      recordedOn: today,
      batchId: '',
      shedId: shed.body.data.id,
      quantity: null,
      unitLabel: '',
      sourceNote: 'Well',
      testNote: '',
      notes: 'Drinkers filled',
    });
    expect(water.status).toBe(201);
    expect(water.body.data.laboratoryResult).toBe(false);
    const missingUnit = await send(http, 'post', `/api/v1/farms/${farmId}/water`, {
      recordedOn: today,
      batchId: '',
      shedId: '',
      quantity: 20,
      unitLabel: '',
      sourceNote: '',
      testNote: '',
      notes: '',
    });
    expect(missingUnit.status).toBe(422);

    const target = await send(http, 'post', `/api/v1/farms/${farmId}/growth-targets`, {
      birdTypeId: bird.body.data.id,
      ageDays: 90,
      targetWeight: 900,
      weightUnit: 'g',
    });
    expect(target.status).toBe(201);
    const weighing = await send(http, 'post', `/api/v1/farms/${farmId}/weighings`, {
      batchId: batch.body.data.id,
      weighedOn: today,
      ageDays: 90,
      weightValue: 850,
      weightUnit: 'g',
      birdCount: null,
      notes: '',
    });
    expect(weighing.status).toBe(201);
    expect(weighing.body.data.ageDays).toBe(90);
    expect(weighing.body.data.ownerTarget).toEqual({ ageDays: 90, targetWeight: 900, weightUnit: 'g' });
    expect(JSON.stringify(weighing.body)).not.toMatch(/fcr|standardWeight|expectedWeight/i);
  });
});
