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
      'report_schedules', 'farm_files', 'notifications', 'sale_returns', 'invoice_lines', 'invoice_documents', 'supplier_payments', 'supplier_bills', 'goods_receipts', 'purchase_order_lines', 'purchase_orders', 'suppliers', 'parentage_records', 'task_training_requirements', 'training_completions', 'training_assignments', 'training_items', 'attendance_records', 'idempotency_keys', 'audit_logs', 'expense_entries', 'expense_categories', 'order_lines', 'orders', 'market_prices', 'customers',
      'loss_incidents', 'sex_counts', 'range_areas', 'batch_movements', 'batches', 'bird_types',
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

describe('desi flock details', () => {
  it('keeps birds on a typed range, stores a strain note, and uses the two counts as the ratio', async () => {
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
    expect((await http.get(`/api/v1/farms/${farmId}/range-areas`)).body.data).toEqual([]);

    const area = await send(http, 'post', `/api/v1/farms/${farmId}/range-areas`, { name: 'Backyard', notes: '' });
    expect(area.status).toBe(201);
    const shed = await send(http, 'post', `/api/v1/farms/${farmId}/sheds`, {
      code: 'Y1', name: 'Yard', shedType: 'other', usableCapacity: 30, status: 'active', notes: '',
    });
    const bird = await send(http, 'post', `/api/v1/farms/${farmId}/bird-types`, { name: 'Desi', strainNote: 'home line' });
    expect(bird.status).toBe(201);
    expect(bird.body.data.strainNote).toBe('home line');
    const batch = await send(http, 'post', `/api/v1/farms/${farmId}/batches`, {
      code: 'D1', birdTypeId: bird.body.data.id, sourceNote: '', hatchDate: '', openedOn: today, shedId: shed.body.data.id, birdCount: 8,
    });
    const batchId = batch.body.data.id as string;

    const out = await send(http, 'post', `/api/v1/farms/${farmId}/batches/${batchId}/movements`, {
      movementType: 'to_range', fromShedId: shed.body.data.id, toShedId: '', fromRangeAreaId: '', toRangeAreaId: area.body.data.id,
      birdCount: 3, occurredOn: today, reason: '',
    });
    expect(out.status).toBe(201);
    expect(out.body.data.batch.liveCount).toBe(8);
    expect(out.body.data.batch.rangePlacements).toEqual([{ rangeAreaId: area.body.data.id, name: 'Backyard', birdCount: 3 }]);
    expect(out.body.data.batch.placements[0].birdCount).toBe(5);

    const back = await send(http, 'post', `/api/v1/farms/${farmId}/batches/${batchId}/movements`, {
      movementType: 'from_range', fromShedId: '', toShedId: shed.body.data.id, fromRangeAreaId: area.body.data.id, toRangeAreaId: '',
      birdCount: 1, occurredOn: today, reason: '',
    });
    expect(back.status).toBe(201);
    expect(back.body.data.batch.liveCount).toBe(8);
    expect(back.body.data.batch.rangePlacements[0].birdCount).toBe(2);

    const died = await send(http, 'post', `/api/v1/farms/${farmId}/batches/${batchId}/movements`, {
      movementType: 'mortality', fromShedId: '', toShedId: '', fromRangeAreaId: area.body.data.id, toRangeAreaId: '',
      birdCount: 2, occurredOn: today, reason: '',
    });
    expect(died.status).toBe(201);
    expect(died.body.data.batch.liveCount).toBe(6);
    expect(died.body.data.batch.rangePlacements).toEqual([]);

    const sexes = await send(http, 'post', `/api/v1/farms/${farmId}/sex-counts`, {
      countedOn: today, batchId, roosterCount: 2, henCount: 4,
    });
    expect(sexes.status).toBe(201);
    expect(sexes.body.data.ratio).toEqual({ roosters: 2, hens: 4 });
    expect(sexes.body.data).not.toHaveProperty('recommended');
    expect(JSON.stringify(sexes.body)).not.toMatch(/recommended/i);

    const tables = await pool.query<RowDataPacket[]>(
      `SELECT table_name AS name FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name LIKE '%breed%'`,
    );
    expect(tables[0] as RowDataPacket[]).toEqual([]);

    expect((await send(http, 'post', `/api/v1/farms/${farmId}/members`, {
      email: 'worker@example.com', displayName: 'Ravi Patil', password: 'worker-password-1', role: 'worker', permissionGrants: [],
    })).status).toBe(201);
    const worker = agent();
    expect((await send(worker, 'post', '/api/v1/auth/login', { email: 'worker@example.com', password: 'worker-password-1' })).status).toBe(200);
    expect((await send(worker, 'post', `/api/v1/farms/${farmId}/range-areas`, { name: 'Lane', notes: '' })).status).toBe(403);
  });
});
