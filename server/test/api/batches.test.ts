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

async function truncate(): Promise<void> {
  const conn = await pool.getConnection();
  try {
    await conn.query('SET FOREIGN_KEY_CHECKS = 0');
    for (const table of [
      'idempotency_keys',
      'audit_logs',
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
  const token = await csrf(http);
  const today = new Date().toISOString().slice(0, 10);
  const registered = await http.post('/api/v1/auth/register').set('X-CSRF-Token', token).send({
    email: 'owner@example.com',
    password,
    displayName: 'Asha More',
    preferredLocale: 'en',
  });
  expect(registered.status).toBe(201);
  const farm = await http.post('/api/v1/farms').set('X-CSRF-Token', await csrf(http)).send({
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
  const shed = await http.post(`/api/v1/farms/${farmId}/sheds`).set('X-CSRF-Token', await csrf(http)).send({
    code: 'A1',
    name: 'Brooder',
    shedType: 'brooder',
    usableCapacity: 100,
    status: 'active',
    notes: '',
  });
  expect(shed.status).toBe(201);
  const other = await http.post(`/api/v1/farms/${farmId}/sheds`).set('X-CSRF-Token', await csrf(http)).send({
    code: 'B1',
    name: 'Grower',
    shedType: 'grower',
    usableCapacity: 50,
    status: 'active',
    notes: '',
  });
  expect(other.status).toBe(201);
  return { http, farmId, shedId: shed.body.data.id as string, otherShedId: other.body.data.id as string, today };
}

describe('batch ledger', () => {
  it('derives live counts from movements and refuses overflow', async () => {
    const { http, farmId, shedId, otherShedId, today } = await registerAndFarm();
    const type = await http.post(`/api/v1/farms/${farmId}/bird-types`).set('X-CSRF-Token', await csrf(http)).send({ name: 'Gavran' });
    expect(type.status).toBe(201);
    const duplicateType = await http.post(`/api/v1/farms/${farmId}/bird-types`).set('X-CSRF-Token', await csrf(http)).send({ name: 'Gavran' });
    expect(duplicateType.status).toBe(409);

    const created = await http
      .post(`/api/v1/farms/${farmId}/batches`)
      .set('X-CSRF-Token', await csrf(http))
      .set('Idempotency-Key', 'batch-open-1')
      .send({
        code: 'g1',
        birdTypeId: type.body.data.id,
        sourceNote: 'hatched on farm',
        hatchDate: '',
        openedOn: today,
        shedId,
        birdCount: 80,
      });
    expect(created.status).toBe(201);
    expect(created.body.data.code).toBe('G1');
    expect(created.body.data.liveCount).toBe(80);
    const replay = await http
      .post(`/api/v1/farms/${farmId}/batches`)
      .set('X-CSRF-Token', await csrf(http))
      .set('Idempotency-Key', 'batch-open-1')
      .send({
        code: 'g9',
        birdTypeId: type.body.data.id,
        sourceNote: '',
        hatchDate: '',
        openedOn: today,
        shedId,
        birdCount: 1,
      });
    expect(replay.status).toBe(201);
    expect(replay.body.data.id).toBe(created.body.data.id);

    const overflow = await http.post(`/api/v1/farms/${farmId}/batches`).set('X-CSRF-Token', await csrf(http)).send({
      code: 'G2',
      birdTypeId: type.body.data.id,
      sourceNote: '',
      hatchDate: '',
      openedOn: today,
      shedId,
      birdCount: 30,
    });
    expect(overflow.status).toBe(409);
    expect(overflow.body.error.code).toBe('CAPACITY_EXCEEDED');

    const batchId = created.body.data.id as string;
    const moved = await http.post(`/api/v1/farms/${farmId}/batches/${batchId}/movements`).set('X-CSRF-Token', await csrf(http)).send({
      movementType: 'transfer',
      fromShedId: shedId,
      toShedId: otherShedId,
      birdCount: 40,
      occurredOn: today,
      reason: 'more space',
    });
    expect(moved.status).toBe(201);
    expect(moved.body.data.batch.liveCount).toBe(80);
    const earlyClose = await http
      .post(`/api/v1/farms/${farmId}/batches/${batchId}/close`)
      .set('X-CSRF-Token', await csrf(http))
      .send({ version: created.body.data.version });
    expect(earlyClose.status).toBe(409);
    expect(earlyClose.body.error.code).toBe('BIRDS_REMAIN');
    const tooMany = await http.post(`/api/v1/farms/${farmId}/batches/${batchId}/movements`).set('X-CSRF-Token', await csrf(http)).send({
      movementType: 'sale',
      fromShedId: shedId,
      toShedId: '',
      birdCount: 50,
      occurredOn: today,
      reason: '',
    });
    expect(tooMany.status).toBe(409);
    expect(tooMany.body.error.code).toBe('INSUFFICIENT_BIRDS');

    const sold = await http.post(`/api/v1/farms/${farmId}/batches/${batchId}/movements`).set('X-CSRF-Token', await csrf(http)).send({
      movementType: 'sale',
      fromShedId: otherShedId,
      toShedId: '',
      birdCount: 40,
      occurredOn: today,
      reason: 'no price stored',
    });
    expect(sold.status).toBe(201);
    const died = await http.post(`/api/v1/farms/${farmId}/batches/${batchId}/movements`).set('X-CSRF-Token', await csrf(http)).send({
      movementType: 'mortality',
      fromShedId: shedId,
      toShedId: '',
      birdCount: 40,
      occurredOn: today,
      reason: '',
    });
    expect(died.status).toBe(201);
    expect(died.body.data.batch.liveCount).toBe(0);

    const detail = await http.get(`/api/v1/farms/${farmId}/batches/${batchId}`);
    expect(detail.body.data.batch.liveCount).toBe(0);
    const closed = await http
      .post(`/api/v1/farms/${farmId}/batches/${batchId}/close`)
      .set('X-CSRF-Token', await csrf(http))
      .send({ version: detail.body.data.batch.version });
    expect(closed.status).toBe(200);
    expect(closed.body.data.status).toBe('closed');
    const after = await http.post(`/api/v1/farms/${farmId}/batches/${batchId}/movements`).set('X-CSRF-Token', await csrf(http)).send({
      movementType: 'culling',
      fromShedId: shedId,
      toShedId: '',
      birdCount: 1,
      occurredOn: today,
      reason: '',
    });
    expect(after.status).toBe(409);
    expect(after.body.error.code).toBe('BATCH_CLOSED');

    const workerInvite = await http.post(`/api/v1/farms/${farmId}/members`).set('X-CSRF-Token', await csrf(http)).send({
      email: 'worker@example.com',
      displayName: 'Ravi Patil',
      password: 'worker-password-1',
      role: 'worker',
      permissionGrants: [],
    });
    expect(workerInvite.status).toBe(201);
    const worker = agent();
    const workerToken = await csrf(worker);
    const loggedIn = await worker.post('/api/v1/auth/login').set('X-CSRF-Token', workerToken).send({
      email: 'worker@example.com',
      password: 'worker-password-1',
    });
    expect(loggedIn.status).toBe(200);
    expect((await worker.get(`/api/v1/farms/${farmId}/batches`)).status).toBe(200);
    expect((await worker.post(`/api/v1/farms/${farmId}/bird-types`).set('X-CSRF-Token', await csrf(worker)).send({ name: 'Other' })).status).toBe(403);
    expect((await worker.get('/api/v1/farms/00000000-0000-4000-8000-000000009999/batches')).status).toBe(404);
  });
});
