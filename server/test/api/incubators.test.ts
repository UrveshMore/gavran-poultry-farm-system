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

async function send(http: Http, method: 'post' | 'patch', path: string, body: object, headers: Record<string, string> = {}) {
  const token = await csrf(http);
  const req = http[method](path).set('X-CSRF-Token', token);
  for (const [key, value] of Object.entries(headers)) req.set(key, value);
  return req.send(body);
}

async function truncate(): Promise<void> {
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
}

beforeEach(truncate);

async function registerAndFarm() {
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
  expect(farm.status).toBe(201);
  return { http, farmId: farm.body.data.id as string, today };
}

const emptyMeasure = { value: null, unit: '' };

describe('incubators', () => {
  it('stores equipment and blank readings, and does not invent a set-point', async () => {
    const { http, farmId, today } = await registerAndFarm();
    const columns = await pool.query<RowDataPacket[]>('SHOW COLUMNS FROM incubator_readings');
    const names = (columns[0] as RowDataPacket[]).map((row) => String(row.Field));
    expect(names).not.toContain('set_point');
    expect(names).not.toContain('temperature_setpoint');

    const created = await send(
      http,
      'post',
      `/api/v1/farms/${farmId}/incubators`,
      { code: 'i1', name: 'Cabinet', capacityEggs: null, notes: '' },
      { 'Idempotency-Key': 'incubator-i1' },
    );
    expect(created.status).toBe(201);
    expect(created.body.data.code).toBe('I1');
    expect(created.body.data.capacityEggs).toBeNull();
    expect(created.body.data.status).toBe('in_service');
    const replay = await send(
      http,
      'post',
      `/api/v1/farms/${farmId}/incubators`,
      { code: 'i9', name: 'Other', capacityEggs: 10, notes: '' },
      { 'Idempotency-Key': 'incubator-i1' },
    );
    expect(replay.body.data.id).toBe(created.body.data.id);
    const duplicate = await send(http, 'post', `/api/v1/farms/${farmId}/incubators`, {
      code: 'I1',
      name: 'Again',
      capacityEggs: 40,
      notes: '',
    });
    expect(duplicate.status).toBe(409);

    const incubatorId = created.body.data.id as string;
    const reading = await send(http, 'post', `/api/v1/farms/${farmId}/incubators/${incubatorId}/readings`, {
      recordedOn: today,
      recordedTime: '',
      temperature: emptyMeasure,
      humidity: emptyMeasure,
      powerStatus: 'unknown',
      source: 'manual',
      notes: 'no set-point entered',
    });
    expect(reading.status).toBe(201);
    expect(reading.body.data.temperatureValue).toBeNull();
    expect(reading.body.data.humidityValue).toBeNull();
    expect(reading.body.data.temperatureUnit).toBeNull();

    const missingUnit = await send(http, 'post', `/api/v1/farms/${farmId}/incubators/${incubatorId}/readings`, {
      recordedOn: today,
      recordedTime: '06:30',
      temperature: { value: 37.2, unit: '' },
      humidity: emptyMeasure,
      powerStatus: 'on',
      source: 'manual',
      notes: '',
    });
    expect(missingUnit.status).toBe(422);

    const withReading = await send(http, 'post', `/api/v1/farms/${farmId}/incubators/${incubatorId}/readings`, {
      recordedOn: today,
      recordedTime: '06:30',
      temperature: { value: 37.2, unit: 'C' },
      humidity: { value: 55, unit: '%' },
      powerStatus: 'on',
      source: 'manual',
      notes: '',
    });
    expect(withReading.status).toBe(201);
    expect(withReading.body.data.temperatureValue).toBe(37.2);
    expect(withReading.body.data.temperatureUnit).toBe('C');

    const stopped = await send(http, 'post', `/api/v1/farms/${farmId}/incubators/${incubatorId}/maintenance`, {
      occurredOn: today,
      status: 'out_of_service',
      notes: 'fan stopped',
    });
    expect(stopped.status).toBe(201);
    expect(stopped.body.data.status).toBe('out_of_service');

    const detail = await http.get(`/api/v1/farms/${farmId}/incubators/${incubatorId}`);
    expect(detail.status).toBe(200);
    expect(detail.body.data.readings).toHaveLength(2);
    expect(detail.body.data.maintenance).toHaveLength(1);

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
    expect((await worker.get(`/api/v1/farms/${farmId}/incubators`)).status).toBe(200);
    const workerReading = await send(worker, 'post', `/api/v1/farms/${farmId}/incubators/${incubatorId}/readings`, {
      recordedOn: today,
      recordedTime: '',
      temperature: emptyMeasure,
      humidity: emptyMeasure,
      powerStatus: 'off',
      source: 'sensor',
      notes: '',
    });
    expect(workerReading.status).toBe(201);
    expect(
      (
        await send(worker, 'post', `/api/v1/farms/${farmId}/incubators`, {
          code: 'W1',
          name: 'Worker machine',
          capacityEggs: null,
          notes: '',
        })
      ).status,
    ).toBe(403);

    const vet = agent();
    expect(
      (
        await send(http, 'post', `/api/v1/farms/${farmId}/members`, {
          email: 'vet@example.com',
          displayName: 'Dr Rao',
          password: 'vet-password-1',
          role: 'vet_advisor',
          permissionGrants: [],
        })
      ).status,
    ).toBe(201);
    expect((await send(vet, 'post', '/api/v1/auth/login', { email: 'vet@example.com', password: 'vet-password-1' })).status).toBe(200);
    expect((await vet.get(`/api/v1/farms/${farmId}/incubators/${incubatorId}`)).status).toBe(200);
    expect(
      (
        await send(vet, 'post', `/api/v1/farms/${farmId}/incubators/${incubatorId}/readings`, {
          recordedOn: today,
          recordedTime: '',
          temperature: emptyMeasure,
          humidity: emptyMeasure,
          powerStatus: 'unknown',
          source: 'manual',
          notes: '',
        })
      ).status,
    ).toBe(403);
    expect((await http.get('/api/v1/farms/00000000-0000-4000-8000-000000009999/incubators')).status).toBe(404);
  });
});
