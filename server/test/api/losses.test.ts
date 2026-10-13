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
      'idempotency_keys', 'audit_logs', 'loss_incidents', 'batch_movements', 'batches', 'bird_types',
      'membership_permission_grants', 'sheds', 'farm_settings', 'farm_memberships', 'sessions',
      'password_reset_tokens', 'farms', 'users',
    ]) {
      await conn.query(`TRUNCATE TABLE \`${table}\``);
    }
    await conn.query('SET FOREIGN_KEY_CHECKS = 1');
  } finally {
    conn.release();
  }
  loginThrottle.reset();
});

describe('loss notes', () => {
  it('stores the note the farm writes and does not calculate a mortality rate', async () => {
    const http = agent();
    const today = new Date().toISOString().slice(0, 10);
    const registered = await send(http, 'post', '/api/v1/auth/register', {
      email: 'owner@example.com', password, displayName: 'Asha More', preferredLocale: 'en',
    });
    expect(registered.status).toBe(201);
    const farm = await send(http, 'post', '/api/v1/farms', {
      name: 'Gavran Farm', code: 'HOME', timezone: 'UTC', locale: 'en', contactName: '', contactPhone: '',
      contactEmail: '', addressLine: '', weightUnit: 'kg', volumeUnit: 'L',
    });
    const farmId = farm.body.data.id as string;
    const shed = await send(http, 'post', `/api/v1/farms/${farmId}/sheds`, {
      code: 'Y1', name: 'Yard', shedType: 'other', usableCapacity: 30, status: 'active', notes: '',
    });
    const bird = await send(http, 'post', `/api/v1/farms/${farmId}/bird-types`, { name: 'Desi' });
    const batch = await send(http, 'post', `/api/v1/farms/${farmId}/batches`, {
      code: 'D1', birdTypeId: bird.body.data.id, sourceNote: '', hatchDate: '', openedOn: today,
      shedId: shed.body.data.id, birdCount: 8,
    });
    const detail = await http.get(`/api/v1/farms/${farmId}/batches/${batch.body.data.id}`);
    const opening = detail.body.data.movements.find((item: { movementType: string }) => item.movementType === 'opening');
    const wrong = await send(http, 'post', `/api/v1/farms/${farmId}/losses`, {
      occurredOn: today, birdCount: 1, note: 'A dog came into the yard at dusk.', movementId: opening.id,
    });
    expect(wrong.status).toBe(422);
    expect(wrong.body.error.details.fields.movementId).toBe('invalid_format');

    const died = await send(http, 'post', `/api/v1/farms/${farmId}/batches/${batch.body.data.id}/movements`, {
      movementType: 'mortality', fromShedId: shed.body.data.id, toShedId: '', birdCount: 1, occurredOn: today, reason: '',
    });
    expect(died.status).toBe(201);
    const after = await http.get(`/api/v1/farms/${farmId}/batches/${batch.body.data.id}`);
    const mortality = after.body.data.movements.find((item: { movementType: string }) => item.movementType === 'mortality');

    const saved = await send(http, 'post', `/api/v1/farms/${farmId}/losses`, {
      occurredOn: today, birdCount: 1, note: 'A dog came into the yard at dusk.', movementId: mortality.id,
    });
    expect(saved.status).toBe(201);
    expect(saved.body.data.batchCode).toBe('D1');
    expect(saved.body.data).not.toHaveProperty('predator');

    const listed = await http.get(`/api/v1/farms/${farmId}/losses`);
    expect(listed.body.data.proposedMortalityRate).toEqual({ status: 'not_calculated', reason: 'decision 4 is open' });
    expect(JSON.stringify(listed.body)).not.toMatch(/percent|predator/i);

    const tables = await pool.query<RowDataPacket[]>(
      `SELECT table_name AS name FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name LIKE '%predator%'`,
    );
    expect(tables[0] as RowDataPacket[]).toEqual([]);
  });
});
