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
      'idempotency_keys',
      'audit_logs',
      'candling_lines',
      'candling_records',
      'incubation_batches',
      'incubator_readings',
      'incubator_maintenance',
      'incubators',
      'egg_collection_lines',
      'egg_collections',
      'egg_categories',
      'batch_movements',
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
  const farmId = farm.body.data.id as string;
  const shed = await send(http, 'post', `/api/v1/farms/${farmId}/sheds`, {
    code: 'A1',
    name: 'Layers',
    shedType: 'layer',
    usableCapacity: 40,
    status: 'active',
    notes: '',
  });
  expect(shed.status).toBe(201);
  return { http, farmId, shedId: shed.body.data.id as string, shedVersion: shed.body.data.version as number, today };
}

describe('egg collections', () => {
  it('records fertile and table counts without a price, and keeps backyard collections', async () => {
    const { http, farmId, shedId, shedVersion, today } = await registerAndFarm();
    const columns = await pool.query<RowDataPacket[]>('SHOW COLUMNS FROM egg_collections');
    const names = (columns[0] as RowDataPacket[]).map((row) => String(row.Field));
    expect(names).not.toContain('price');

    const fertile = await send(http, 'post', `/api/v1/farms/${farmId}/egg-categories`, { name: 'Fertile' });
    expect(fertile.status).toBe(201);
    const table = await send(http, 'post', `/api/v1/farms/${farmId}/egg-categories`, { name: 'Table' });
    expect(table.status).toBe(201);
    const duplicate = await send(http, 'post', `/api/v1/farms/${farmId}/egg-categories`, { name: 'Fertile' });
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error.code).toBe('DUPLICATE_CODE');

    const empty = await send(http, 'post', `/api/v1/farms/${farmId}/eggs`, {
      collectedOn: today,
      batchId: '',
      shedId: '',
      shiftLabel: '',
      notes: '',
      lines: [
        { categoryId: fertile.body.data.id, eggCount: 0 },
        { categoryId: table.body.data.id, eggCount: 0 },
      ],
    });
    expect(empty.status).toBe(422);
    expect(empty.body.error.details.fields.lines).toBe('too_small');

    const negative = await send(http, 'post', `/api/v1/farms/${farmId}/eggs`, {
      collectedOn: today,
      batchId: '',
      shedId: '',
      shiftLabel: '',
      notes: '',
      lines: [{ categoryId: fertile.body.data.id, eggCount: -3 }],
    });
    expect(negative.status).toBe(422);

    const future = await send(http, 'post', `/api/v1/farms/${farmId}/eggs`, {
      collectedOn: '2099-01-01',
      batchId: '',
      shedId: '',
      shiftLabel: 'morning',
      notes: '',
      lines: [{ categoryId: fertile.body.data.id, eggCount: 1 }],
    });
    expect(future.status).toBe(422);
    expect(future.body.error.details.fields.collectedOn).toBe('too_big');

    const recorded = await send(
      http,
      'post',
      `/api/v1/farms/${farmId}/eggs`,
      {
        collectedOn: today,
        batchId: '',
        shedId: '',
        shiftLabel: 'morning',
        notes: 'backyard nest',
        lines: [
          { categoryId: fertile.body.data.id, eggCount: 4 },
          { categoryId: table.body.data.id, eggCount: 7 },
        ],
      },
      { 'Idempotency-Key': 'eggs-morning-1' },
    );
    expect(recorded.status).toBe(201);
    expect(recorded.body.data.total).toBe(11);
    expect(recorded.body.data.batchId).toBeNull();
    expect(recorded.body.data.shedId).toBeNull();
    expect(recorded.body.data).not.toHaveProperty('price');
    expect(JSON.stringify(recorded.body.data)).not.toContain('price');

    const replay = await send(
      http,
      'post',
      `/api/v1/farms/${farmId}/eggs`,
      {
        collectedOn: today,
        batchId: '',
        shedId: shedId,
        shiftLabel: 'evening',
        notes: 'different',
        lines: [{ categoryId: table.body.data.id, eggCount: 1 }],
      },
      { 'Idempotency-Key': 'eggs-morning-1' },
    );
    expect(replay.status).toBe(201);
    expect(replay.body.data.id).toBe(recorded.body.data.id);
    expect(replay.body.data.total).toBe(11);

    const paused = await send(http, 'patch', `/api/v1/farms/${farmId}/sheds/${shedId}`, {
      status: 'inactive',
      version: shedVersion,
    });
    expect(paused.status).toBe(200);
    const withShed = await send(http, 'post', `/api/v1/farms/${farmId}/eggs`, {
      collectedOn: today,
      batchId: '',
      shedId,
      shiftLabel: '',
      notes: '',
      lines: [{ categoryId: table.body.data.id, eggCount: 2 }],
    });
    expect(withShed.status).toBe(201);
    expect(withShed.body.data.shedCode).toBe('A1');
    expect(withShed.body.data.lines).toEqual([{ categoryId: table.body.data.id, categoryName: 'Table', eggCount: 2 }]);

    const listed = await http.get(`/api/v1/farms/${farmId}/eggs`);
    expect(listed.status).toBe(200);
    expect(listed.body.data).toHaveLength(2);

    expect((await http.get('/api/v1/farms/00000000-0000-4000-8000-000000009999/eggs')).status).toBe(404);

    const workerInvite = await send(http, 'post', `/api/v1/farms/${farmId}/members`, {
      email: 'worker@example.com',
      displayName: 'Ravi Patil',
      password: 'worker-password-1',
      role: 'worker',
      permissionGrants: [],
    });
    expect(workerInvite.status).toBe(201);
    const worker = agent();
    const loggedIn = await send(worker, 'post', '/api/v1/auth/login', {
      email: 'worker@example.com',
      password: 'worker-password-1',
    });
    expect(loggedIn.status).toBe(200);
    const workerRecord = await send(worker, 'post', `/api/v1/farms/${farmId}/eggs`, {
      collectedOn: today,
      batchId: '',
      shedId: '',
      shiftLabel: '',
      notes: '',
      lines: [{ categoryId: fertile.body.data.id, eggCount: 1 }],
    });
    expect(workerRecord.status).toBe(201);

    const vetInvite = await send(http, 'post', `/api/v1/farms/${farmId}/members`, {
      email: 'vet@example.com',
      displayName: 'Dr Rao',
      password: 'vet-password-1',
      role: 'vet_advisor',
      permissionGrants: [],
    });
    expect(vetInvite.status).toBe(201);
    const vet = agent();
    expect((await send(vet, 'post', '/api/v1/auth/login', { email: 'vet@example.com', password: 'vet-password-1' })).status).toBe(200);
    expect((await vet.get(`/api/v1/farms/${farmId}/eggs`)).status).toBe(200);
    expect((await send(vet, 'post', `/api/v1/farms/${farmId}/egg-categories`, { name: 'Cracked' })).status).toBe(403);

    const helperInvite = await send(http, 'post', `/api/v1/farms/${farmId}/members`, {
      email: 'helper@example.com',
      displayName: 'Mina More',
      password: 'helper-password-1',
      role: 'family_helper',
      permissionGrants: [],
    });
    expect(helperInvite.status).toBe(201);
    const helper = agent();
    expect((await send(helper, 'post', '/api/v1/auth/login', { email: 'helper@example.com', password: 'helper-password-1' })).status).toBe(200);
    expect((await helper.get(`/api/v1/farms/${farmId}/eggs`)).status).toBe(403);
  });

  it('rejects a closed batch and a category from another farm', async () => {
    const { http, farmId, shedId, today } = await registerAndFarm();
    const type = await send(http, 'post', `/api/v1/farms/${farmId}/bird-types`, { name: 'Gavran desi' });
    expect(type.status).toBe(201);
    const batch = await send(http, 'post', `/api/v1/farms/${farmId}/batches`, {
      code: 'B1',
      birdTypeId: type.body.data.id,
      sourceNote: '',
      hatchDate: '',
      openedOn: today,
      shedId,
      birdCount: 2,
    });
    expect(batch.status).toBe(201);
    const sold = await send(http, 'post', `/api/v1/farms/${farmId}/batches/${batch.body.data.id}/movements`, {
        movementType: 'sale',
        fromShedId: shedId,
        toShedId: '',
        birdCount: 2,
        occurredOn: today,
        reason: '',
      });
    expect(sold.status).toBe(201);
    const closed = await send(http, 'post', `/api/v1/farms/${farmId}/batches/${batch.body.data.id}/close`, {
      version: batch.body.data.version,
    });
    expect(closed.status).toBe(200);

    const category = await send(http, 'post', `/api/v1/farms/${farmId}/egg-categories`, { name: 'Table' });
    expect(category.status).toBe(201);
    const onClosed = await send(http, 'post', `/api/v1/farms/${farmId}/eggs`, {
      collectedOn: today,
      batchId: batch.body.data.id,
      shedId: '',
      shiftLabel: '',
      notes: '',
      lines: [{ categoryId: category.body.data.id, eggCount: 1 }],
    });
    expect(onClosed.status).toBe(422);
    expect(onClosed.body.error.details.fields.batchId).toBe('invalid_format');

    const foreign = await send(http, 'post', `/api/v1/farms/${farmId}/eggs`, {
      collectedOn: today,
      batchId: '',
      shedId: '',
      shiftLabel: '',
      notes: '',
      lines: [{ categoryId: '00000000-0000-4000-8000-000000000999', eggCount: 1 }],
    });
    expect(foreign.status).toBe(422);
    expect(foreign.body.error.details.fields.lines).toBe('invalid_format');
  });
});
