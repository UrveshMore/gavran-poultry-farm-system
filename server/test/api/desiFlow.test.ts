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
async function send(http: Http, method: 'post' | 'patch' | 'put', path: string, body: object) {
  const token = await csrf(http);
  return http[method](path).set('X-CSRF-Token', token).send(body);
}

beforeEach(async () => {
  const conn = await pool.getConnection();
  try {
    await conn.query('SET FOREIGN_KEY_CHECKS = 0');
    for (const table of [
      'flow_sales',
      'flow_expenses',
      'flow_egg_entries',
      'flow_feed_entries',
      'flow_dose_marks',
      'flow_moves',
      'flow_hatch_days',
      'flow_batches',
      'flow_sheds',
      'flow_incubators',
      'flow_setup',
      'tray_hatch_days',
      'tray_sets',
      'incubator_trays',
      'egg_lots',
      'bird_events',
      'batch_dose_marks', 'medicine_photos', 'farm_schedule_approvals', 'yard_notes', 'report_schedules', 'farm_files', 'notifications', 'sale_returns', 'invoice_lines', 'invoice_documents', 'supplier_payments', 'supplier_bills', 'goods_receipts', 'purchase_order_lines', 'purchase_orders', 'suppliers', 'parentage_records', 'task_training_requirements', 'training_completions', 'training_assignments', 'training_items', 'attendance_records', 'idempotency_keys',
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
      'notification_settings',
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

describe('desi egg lots, trays, and birds', () => {
  it('saves a lot, a tray, a hatch day, birds that left, and quantity times rate', async () => {
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
    const shed = await send(http, 'post', `/api/v1/farms/${farmId}/sheds`, {
      code: 'B1', name: 'Brooder', shedType: 'brooder', usableCapacity: 200, status: 'active', notes: '',
    });
    expect(shed.status).toBe(201);
    const machine = await send(http, 'post', `/api/v1/farms/${farmId}/incubators`, {
      code: 'I1', name: 'Cabinet', capacityEggs: null, notes: '',
    });
    expect(machine.status).toBe(201);

    const future = await send(http, 'post', `/api/v1/farms/${farmId}/egg-lots`, {
      sourceName: 'Tomorrow market', receivedOn: '2099-01-01', eggCount: 10, notes: '',
    });
    expect(future.status).toBe(422);

    const lot = await send(http, 'post', `/api/v1/farms/${farmId}/egg-lots`, {
      sourceName: 'Village market', receivedOn: today, eggCount: 120, notes: 'Bought',
    });
    expect(lot.status).toBe(201);
    const tray = await send(http, 'post', `/api/v1/farms/${farmId}/trays`, { incubatorId: machine.body.data.id, name: '1' });
    expect(tray.status).toBe(201);
    const again = await send(http, 'post', `/api/v1/farms/${farmId}/trays`, { incubatorId: machine.body.data.id, name: '1' });
    expect(again.status).toBe(409);
    const trayTwo = await send(http, 'post', `/api/v1/farms/${farmId}/trays`, { incubatorId: machine.body.data.id, name: '2' });
    expect(trayTwo.status).toBe(201);

    const sitting = await send(http, 'post', `/api/v1/farms/${farmId}/tray-sets`, {
      trayId: tray.body.data.id, lotId: lot.body.data.id, setOn: today, eggCount: 90,
    });
    expect(sitting.status).toBe(201);
    const hatch = await send(http, 'post', `/api/v1/farms/${farmId}/tray-sets/${sitting.body.data.id}/hatches`, {
      hatchedOn: today, liveCount: 40, shedId: shed.body.data.id, batchCode: 'c1',
    });
    expect(hatch.status).toBe(201);
    const duplicateDay = await send(http, 'post', `/api/v1/farms/${farmId}/tray-sets/${sitting.body.data.id}/hatches`, {
      hatchedOn: today, liveCount: 1, shedId: shed.body.data.id, batchCode: 'c9',
    });
    expect(duplicateDay.status).toBe(409);

    const small = await send(http, 'post', `/api/v1/farms/${farmId}/tray-sets`, {
      trayId: trayTwo.body.data.id, lotId: '', setOn: today, eggCount: 10,
    });
    const over = await send(http, 'post', `/api/v1/farms/${farmId}/tray-sets/${small.body.data.id}/hatches`, {
      hatchedOn: today, liveCount: 12, shedId: shed.body.data.id, batchCode: 'c2',
    });
    expect(over.status).toBe(201);

    const page = await http.get(`/api/v1/farms/${farmId}/desi`);
    expect(page.status).toBe(200);
    const first = page.body.data.sets.find((row: { id: string }) => row.id === sitting.body.data.id);
    expect(first.live).toBe(40);
    expect(first.bad).toBe(50);
    expect(first.ratio).toBe(44.4);
    expect(first.ratioBasis).toBe('not_set');
    const second = page.body.data.sets.find((row: { id: string }) => row.id === small.body.data.id);
    expect(second.live).toBe(12);
    expect(second.bad).toBe(-2);
    expect(second.ratio).toBe(120);

    const flock = await http.get(`/api/v1/farms/${farmId}/batches/${hatch.body.data.batchId}`);
    expect(flock.body.data.batch.birdTypeName).toBe('Gavran');
    expect(flock.body.data.batch.eggSetOn).toBe(today);
    expect(flock.body.data.batch.code).toBe('C1');
    expect(flock.body.data.batch.liveCount).toBe(40);

    const died = await send(http, 'post', `/api/v1/farms/${farmId}/bird-events`, {
      occurredOn: today, kind: 'died', birdCount: 1, amount: null, unitLabel: '', notes: '', batchId: hatch.body.data.batchId,
    });
    expect(died.status).toBe(201);
    const eaten = await send(http, 'post', `/api/v1/farms/${farmId}/bird-events`, {
      occurredOn: today, kind: 'eaten', birdCount: 1, amount: null, unitLabel: '', notes: 'Home', batchId: hatch.body.data.batchId,
    });
    expect(eaten.status).toBe(201);
    const sold = await send(http, 'post', `/api/v1/farms/${farmId}/bird-events`, {
      occurredOn: today, kind: 'sold', birdCount: 2, amount: 800, unitLabel: 'Rs', notes: '', batchId: hatch.body.data.batchId,
    });
    expect(sold.status).toBe(201);
    const after = await http.get(`/api/v1/farms/${farmId}/batches/${hatch.body.data.batchId}`);
    expect(after.body.data.batch.liveCount).toBe(36);

    const category = await send(http, 'post', `/api/v1/farms/${farmId}/expense-categories`, { name: 'Feed' });
    const entry = await send(http, 'post', `/api/v1/farms/${farmId}/expenses`, {
      occurredOn: today, direction: 'expense', categoryId: category.body.data.id, amount: 1, quantity: 2, rate: 25,
      unitLabel: 'Rs', counterparty: '', referenceNote: '', notes: 'Maize', batchId: '',
    });
    expect(entry.status).toBe(201);
    expect(entry.body.data.amount).toBe(50);
    expect(entry.body.data.quantity).toBe(2);
    expect(entry.body.data.rate).toBe(25);

    const board = await http.get(`/api/v1/farms/${farmId}/dashboard`);
    const lost = board.body.data.charts.losses.find((day: { date: string }) => day.date === today);
    expect(lost.count).toBe(1);
    expect(board.body.data.charts.lossRate).toBe('not_set');
    const money = board.body.data.charts.money.find((row: { unitLabel: string | null }) => row.unitLabel === 'Rs');
    expect(money).toEqual({ unitLabel: 'Rs', income: 800, kharch: 50, difference: 750 });
    expect(board.body.data.charts.moneyBasis).toBe('not_set');

    expect((await send(http, 'post', `/api/v1/farms/${farmId}/members`, {
      email: 'worker@example.com', displayName: 'Ravi Patil', password: 'worker-password-1', role: 'worker', permissionGrants: [],
    })).status).toBe(201);
    const worker = agent();
    expect((await send(worker, 'post', '/api/v1/auth/login', { email: 'worker@example.com', password: 'worker-password-1' })).status).toBe(200);
    const blocked = await send(worker, 'post', `/api/v1/farms/${farmId}/bird-events`, {
      occurredOn: today, kind: 'sold', birdCount: 1, amount: 100, unitLabel: 'Rs', notes: '', batchId: hatch.body.data.batchId,
    });
    expect(blocked.status).toBe(403);
  });
});
