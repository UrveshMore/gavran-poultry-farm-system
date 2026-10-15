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
async function send(http: Http, method: 'post' | 'patch' | 'put' | 'delete', path: string, body?: object) {
  const token = await csrf(http);
  const call = http[method](path).set('X-CSRF-Token', token);
  return body === undefined ? call : call.send(body);
}

function plus(iso: string, days: number): string {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, (day ?? 1) + days)).toISOString().slice(0, 10);
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

describe('flow-3 farm book', () => {
  it('saves every screen, keeps totals, and edits or deletes each kind of line', async () => {
    const http = agent();
    const today = new Date().toISOString().slice(0, 10);
    const hatchSet = plus(today, -21);
    expect((await send(http, 'post', '/api/v1/auth/register', {
      email: 'owner@example.com', password, displayName: 'Asha More', preferredLocale: 'en',
    })).status).toBe(201);
    const farm = await send(http, 'post', '/api/v1/farms', {
      name: 'Gavran Farm', code: 'HOME', timezone: 'UTC', locale: 'en', contactName: '', contactPhone: '',
      contactEmail: '', addressLine: '', weightUnit: 'kg', volumeUnit: 'L',
    });
    const farmId = farm.body.data.id as string;
    const base = `/api/v1/farms/${farmId}`;

    const first = await http.get(`${base}/flow`);
    expect(first.status).toBe(200);
    expect(first.body.data.scheduleFound).toBe(true);
    expect(first.body.data.scheduleSource).toBe('patil-poultry-step-by-step-process.pdf');
    expect(first.body.data.season).toBe('not_in_source');
    expect(first.body.data.incubators.map((row: { capacity: number }) => row.capacity)).toEqual([100, 80]);
    const names = (first.body.data.doseRows as { itemName: string; dayFrom: number | null }[])
      .filter((row) => row.dayFrom !== null && row.dayFrom <= 28 && /vaccine|booster/i.test(row.itemName))
      .map((row) => row.itemName);
    expect(names).toEqual(expect.arrayContaining(['Marek vaccine', 'Lasota vaccine', 'Gumboro vaccine', 'Gumboro booster']));

    const small = await send(http, 'post', `${base}/flow/sheds`, { name: 'Small', capacity: 5 });
    const big = await send(http, 'post', `${base}/flow/sheds`, { name: 'Big', capacity: 40 });
    expect(small.status).toBe(201);
    expect(big.status).toBe(201);

    const existing = await send(http, 'post', `${base}/flow/batches`, {
      kind: 'existing', birdCount: 3, shedId: big.body.data.id, placedOn: today, notes: 'e2e-flow3',
    });
    expect(existing.status).toBe(201);
    expect(existing.body.data.number).toBe(0);
    expect((await send(http, 'post', `${base}/flow/batches`, {
      kind: 'existing', birdCount: 1, shedId: big.body.data.id, placedOn: today, notes: '',
    })).status).toBe(409);

    const machine = (first.body.data.incubators as { id: string; capacity: number }[]).find((row) => row.capacity === 100);
    const set = await send(http, 'post', `${base}/flow/batches`, {
      kind: 'set', incubatorId: machine?.id, eggsSet: 120, setOn: hatchSet, notes: 'e2e-flow3',
    });
    expect(set.status).toBe(201);
    expect(set.body.data.number).toBe(1);
    expect(set.body.data.hatchOn).toBe(today);
    expect(set.body.data.capacityWarning).toBe(true);
    expect((await send(http, 'post', `${base}/flow/batches`, {
      kind: 'set', incubatorId: machine?.id, eggsSet: 10, setOn: plus(today, 1), notes: '',
    })).status).toBe(422);

    const batchId = set.body.data.id as string;
    expect((await send(http, 'post', `${base}/flow/batches/${batchId}/hatch-days`, { dayNumber: 1, liveCount: 8 })).status).toBe(201);
    const day2 = await send(http, 'post', `${base}/flow/batches/${batchId}/hatch-days`, { dayNumber: 2, liveCount: 4 });
    expect(day2.status).toBe(201);
    const death = await send(http, 'post', `${base}/flow/moves`, {
      batchId, kind: 'brooding_death', birdCount: 1, occurredOn: today, notes: 'e2e-flow3',
    });
    expect(death.status).toBe(201);
    const toShed = await send(http, 'post', `${base}/flow/moves`, {
      batchId, kind: 'to_shed', birdCount: 6, occurredOn: today, shedId: small.body.data.id, notes: 'e2e-flow3',
    });
    expect(toShed.status).toBe(201);
    expect(toShed.body.data.capacityWarning).toBe(true);
    const between = await send(http, 'post', `${base}/flow/moves`, {
      batchId, kind: 'between_sheds', birdCount: 2, occurredOn: today, fromShedId: small.body.data.id, shedId: big.body.data.id, notes: 'e2e-flow3',
    });
    expect(between.status).toBe(201);
    const died = await send(http, 'post', `${base}/flow/moves`, {
      batchId: existing.body.data.id, kind: 'exit', birdCount: 1, occurredOn: today, shedId: big.body.data.id, reason: 'died', notes: 'e2e-flow3',
    });
    const sold = await send(http, 'post', `${base}/flow/moves`, {
      batchId: existing.body.data.id, kind: 'exit', birdCount: 1, occurredOn: today, shedId: big.body.data.id, reason: 'sold',
      buyer: 'E2E Raju', quantity: 1, price: 200, unitLabel: 'Rs', notes: 'e2e-flow3',
    });
    const other = await send(http, 'post', `${base}/flow/moves`, {
      batchId: existing.body.data.id, kind: 'exit', birdCount: 1, occurredOn: today, shedId: big.body.data.id, reason: 'other', notes: 'e2e-flow3',
    });
    expect(died.status).toBe(201);
    expect(sold.status).toBe(201);
    expect(other.status).toBe(201);

    const marek = (first.body.data.doseRows as { id: string; itemName: string }[]).find((row) => row.itemName === 'Marek vaccine');
    const mark = await send(http, 'post', `${base}/flow/doses`, { batchId, scheduleRowId: marek?.id, givenOn: today, notes: 'e2e-flow3' });
    expect(mark.status).toBe(201);
    const feed = await send(http, 'post', `${base}/flow/feed`, {
      batchId, occurredOn: today, feedType: 'starter mash', quantity: 2.5, unitLabel: 'kg', notes: 'e2e-flow3',
    });
    expect(feed.body.data.ageDay).toBe(1);
    expect(feed.body.data.seasonLabel).toBe('not_in_source');
    const eggs = await send(http, 'post', `${base}/flow/eggs`, { occurredOn: today, collected: 24, sold: 10, forIncubator: 6, notes: 'e2e-flow3' });
    expect((await send(http, 'post', `${base}/flow/eggs`, { occurredOn: plus(today, -1), collected: 4, sold: 0, forIncubator: 0, notes: 'e2e-flow3' })).status).toBe(201);
    const expense = await send(http, 'post', `${base}/flow/expenses`, { occurredOn: today, category: 'feed', amount: 50, unitLabel: 'Rs', notes: 'e2e-flow3' });
    expect((await send(http, 'post', `${base}/flow/expenses`, { occurredOn: today, category: 'medicine', amount: 20, unitLabel: 'Rs', notes: 'e2e-flow3' })).status).toBe(201);
    const sale = await send(http, 'post', `${base}/flow/sales`, {
      occurredOn: today, kind: 'eggs', quantity: 10, price: 8, buyer: 'E2E Market', unitLabel: 'Rs', notes: 'e2e-flow3',
    });
    expect(sale.body.data.amount).toBe(80);

    const board = await http.get(`${base}/flow`);
    const data = board.body.data;
    const flock = (data.batches as { number: number; liveTotal: number; bad: number; ratio: number; ratioBasis: string; broodingLive: number; medicine: { nextDay: number; today: { itemName: string; given: boolean }[] } }[]).find((row) => row.number === 1);
    expect(flock).toMatchObject({ liveTotal: 12, bad: 108, ratio: 10, ratioBasis: 'not_set', broodingLive: 5 });
    expect(flock?.medicine.nextDay).toBe(2);
    expect(flock?.medicine.today.find((row) => row.itemName === 'Marek vaccine')?.given).toBe(true);
    expect(data.home).toMatchObject({ broodingCount: 5, shedCount: 6, todayEggs: 24 });
    expect(data.eggStock).toBe(12);
    expect(data.home.todayFeed).toEqual([expect.objectContaining({ feedType: 'starter mash', quantity: 2.5, unitLabel: 'kg' })]);
    expect(data.home.month).toEqual([expect.objectContaining({ unit: 'Rs', sales: 280, expenses: 70, difference: 210, basis: 'not_set' })]);
    expect(data.sales).toEqual(expect.arrayContaining([expect.objectContaining({ buyer: 'E2E Raju', amount: 200, kind: 'birds' })]));
    const smallShed = (data.sheds as { name: string; overCapacity: boolean; birdCount: number }[]).find((row) => row.name === 'Small');
    expect(smallShed).toMatchObject({ birdCount: 4, overCapacity: false });

    expect((await send(http, 'patch', `${base}/flow/eggs/${eggs.body.data.id}`, { occurredOn: today, collected: 20, sold: 10, forIncubator: 6, notes: 'e2e-flow3' })).status).toBe(200);
    expect((await send(http, 'patch', `${base}/flow/hatch-days/${day2.body.data.id}`, { dayNumber: 2, liveCount: 5 })).status).toBe(200);
    expect((await send(http, 'patch', `${base}/flow/feed/${feed.body.data.id}`, { batchId, occurredOn: today, feedType: 'grower mash', quantity: 3, unitLabel: 'kg', notes: 'e2e-flow3' })).status).toBe(200);
    expect((await send(http, 'patch', `${base}/flow/expenses/${expense.body.data.id}`, { occurredOn: today, category: 'electricity', amount: 40, unitLabel: 'Rs', notes: 'e2e-flow3' })).status).toBe(200);
    expect((await send(http, 'patch', `${base}/flow/sales/${sale.body.data.id}`, { occurredOn: today, kind: 'eggs', quantity: 10, price: 9, buyer: 'E2E Market', unitLabel: 'Rs', notes: 'e2e-flow3' })).status).toBe(200);
    expect((await send(http, 'patch', `${base}/flow/doses/${mark.body.data.id}`, { batchId, scheduleRowId: marek?.id, givenOn: plus(today, -1), notes: 'e2e-flow3' })).status).toBe(200);
    expect((await send(http, 'patch', `${base}/flow/sheds/${small.body.data.id}`, { name: 'Small shed', capacity: 5 })).status).toBe(200);
    expect((await send(http, 'patch', `${base}/flow/incubators/${machine?.id}`, { name: 'Big box renamed', capacity: 100 })).status).toBe(200);
    expect((await send(http, 'patch', `${base}/flow/moves/${death.body.data.id}`, { batchId, kind: 'brooding_death', birdCount: 2, occurredOn: today, notes: 'e2e-flow3' })).status).toBe(200);

    expect((await send(http, 'delete', `${base}/flow/feed/${feed.body.data.id}`)).status).toBe(200);
    expect((await send(http, 'delete', `${base}/flow/sales/${sale.body.data.id}`)).status).toBe(200);
    expect((await send(http, 'delete', `${base}/flow/doses/${mark.body.data.id}`)).status).toBe(200);
    const spare = await send(http, 'post', `${base}/flow/incubators`, { name: 'Spare', capacity: 10 });
    expect((await send(http, 'delete', `${base}/flow/incubators/${spare.body.data.id}`)).status).toBe(200);
    const spareShed = await send(http, 'post', `${base}/flow/sheds`, { name: 'Spare shed', capacity: 3 });
    expect((await send(http, 'delete', `${base}/flow/sheds/${spareShed.body.data.id}`)).status).toBe(200);

    const after = await http.get(`${base}/flow`);
    const afterFlock = (after.body.data.batches as { number: number; liveTotal: number; broodingLive: number; medicine: { today: { itemName: string; given: boolean }[] } }[]).find((row) => row.number === 1);
    expect(afterFlock).toMatchObject({ liveTotal: 13, broodingLive: 5 });
    expect(after.body.data.eggStock).toBe(8);
    expect(after.body.data.feed).toEqual([]);
    expect(after.body.data.home.month[0]).toMatchObject({ sales: 200, expenses: 60, difference: 140 });
    expect(afterFlock?.medicine.today.find((row) => row.itemName === 'Marek vaccine')?.given).toBe(false);
    expect((after.body.data.incubators as { name: string }[]).some((row) => row.name === 'Big box renamed')).toBe(true);
  });
});
