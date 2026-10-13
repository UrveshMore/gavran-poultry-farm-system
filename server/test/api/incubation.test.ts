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
      'parentage_records', 'task_training_requirements', 'training_completions', 'training_assignments', 'training_items', 'attendance_records', 'idempotency_keys',
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

async function ownerFarm() {
  const http = agent();
  const today = new Date().toISOString().slice(0, 10);
  expect(
    (await send(http, 'post', '/api/v1/auth/register', { email: 'owner@example.com', password, displayName: 'Asha More', preferredLocale: 'en' })).status,
  ).toBe(201);
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

describe('incubation', () => {
  it('records a broody hen or an in-service incubator and keeps candling as separate notes', async () => {
    const { http, farmId, today } = await ownerFarm();
    const hen = await send(http, 'post', `/api/v1/farms/${farmId}/incubation`, {
      code: 'h1',
      mode: 'broody_hen',
      incubatorId: '',
      henName: 'Kaveri',
      startedOn: today,
      eggCount: 8,
      notes: 'nest by the coop',
      expectedHatchOn: '2026-11-03',
    });
    expect(hen.status).toBe(201);
    expect(hen.body.data.mode).toBe('broody_hen');
    expect(hen.body.data.henName).toBe('Kaveri');
    expect(hen.body.data).not.toHaveProperty('expectedHatchOn');
    expect(JSON.stringify(hen.body.data)).not.toMatch(/expectedHatch|dueOn|hatchDay/);

    const machine = await send(http, 'post', `/api/v1/farms/${farmId}/incubators`, {
      code: 'C1',
      name: 'Cabinet',
      capacityEggs: 10,
      notes: '',
    });
    expect(machine.status).toBe(201);
    const incubatorId = machine.body.data.id as string;
    expect(
      (
        await send(http, 'post', `/api/v1/farms/${farmId}/incubators/${incubatorId}/maintenance`, {
          occurredOn: today,
          status: 'out_of_service',
          notes: '',
        })
      ).status,
    ).toBe(201);
    const blocked = await send(http, 'post', `/api/v1/farms/${farmId}/incubation`, {
      code: 'M1',
      mode: 'incubator',
      incubatorId,
      henName: '',
      startedOn: today,
      eggCount: 4,
      notes: '',
    });
    expect(blocked.status).toBe(409);
    expect(blocked.body.error.code).toBe('INCUBATOR_OUT');
    expect(
      (
        await send(http, 'post', `/api/v1/farms/${farmId}/incubators/${incubatorId}/maintenance`, {
          occurredOn: today,
          status: 'in_service',
          notes: '',
        })
      ).status,
    ).toBe(201);
    const tooMany = await send(http, 'post', `/api/v1/farms/${farmId}/incubation`, {
      code: 'M2',
      mode: 'incubator',
      incubatorId,
      henName: '',
      startedOn: today,
      eggCount: 11,
      notes: '',
    });
    expect(tooMany.status).toBe(409);
    expect(tooMany.body.error.code).toBe('INCUBATOR_CAPACITY');
    const loaded = await send(http, 'post', `/api/v1/farms/${farmId}/incubation`, {
      code: 'M3',
      mode: 'incubator',
      incubatorId,
      henName: '',
      startedOn: today,
      eggCount: 10,
      notes: '',
    });
    expect(loaded.status).toBe(201);

    const sittingId = hen.body.data.id as string;
    const bad = await send(http, 'post', `/api/v1/farms/${farmId}/incubation/${sittingId}/candling`, {
      observedOn: today,
      inspectedCount: 8,
      notes: '',
      lines: [
        { label: 'clear', eggCount: 3 },
        { label: 'dark', eggCount: 3 },
      ],
    });
    expect(bad.status).toBe(422);
    const first = await send(http, 'post', `/api/v1/farms/${farmId}/incubation/${sittingId}/candling`, {
      observedOn: today,
      inspectedCount: 8,
      notes: 'owner labels',
      lines: [
        { label: 'clear', eggCount: 5 },
        { label: 'dark', eggCount: 3 },
      ],
    });
    expect(first.status).toBe(201);
    const second = await send(http, 'post', `/api/v1/farms/${farmId}/incubation/${sittingId}/candling`, {
      observedOn: today,
      inspectedCount: 8,
      notes: 'second look',
      lines: [{ label: 'still sitting', eggCount: 8 }],
    });
    expect(second.status).toBe(201);
    expect(second.body.data.id).not.toBe(first.body.data.id);
    const detail = await http.get(`/api/v1/farms/${farmId}/incubation/${sittingId}`);
    expect(detail.body.data.candling).toHaveLength(2);

    const worker = agent();
    expect(
      (
        await send(http, 'post', `/api/v1/farms/${farmId}/members`, {
          email: 'worker@example.com',
          displayName: 'Ravi Patil',
          password: 'worker-password-1',
          role: 'worker',
          permissionGrants: [],
        })
      ).status,
    ).toBe(201);
    expect((await send(worker, 'post', '/api/v1/auth/login', { email: 'worker@example.com', password: 'worker-password-1' })).status).toBe(200);
    expect(
      (
        await send(worker, 'post', `/api/v1/farms/${farmId}/incubation`, {
          code: 'H2',
          mode: 'broody_hen',
          incubatorId: '',
          henName: 'Moti',
          startedOn: today,
          eggCount: 6,
          notes: '',
        })
      ).status,
    ).toBe(201);
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
    expect((await vet.get(`/api/v1/farms/${farmId}/incubation`)).status).toBe(200);
    expect(
      (
        await send(vet, 'post', `/api/v1/farms/${farmId}/incubation`, {
          code: 'H3',
          mode: 'broody_hen',
          incubatorId: '',
          henName: 'No',
          startedOn: today,
          eggCount: 1,
          notes: '',
        })
      ).status,
    ).toBe(403);
    expect((await http.get('/api/v1/farms/00000000-0000-4000-8000-000000009999/incubation')).status).toBe(404);
  });

  it('opens a chick batch from live chicks and labels the hatch rate as proposed', async () => {
    const { http, farmId, today } = await ownerFarm();
    const shed = await send(http, 'post', `/api/v1/farms/${farmId}/sheds`, {
      code: 'A1',
      name: 'Brooder',
      shedType: 'brooder',
      usableCapacity: 20,
      status: 'active',
      notes: '',
    });
    expect(shed.status).toBe(201);
    const type = await send(http, 'post', `/api/v1/farms/${farmId}/bird-types`, { name: 'Gavran desi' });
    expect(type.status).toBe(201);
    const sitting = await send(http, 'post', `/api/v1/farms/${farmId}/incubation`, {
      code: 'S1',
      mode: 'broody_hen',
      incubatorId: '',
      henName: 'Kaveri',
      startedOn: today,
      eggCount: 10,
      notes: '',
    });
    expect(sitting.status).toBe(201);
    const sittingId = sitting.body.data.id as string;
    const uneven = await send(http, 'post', `/api/v1/farms/${farmId}/incubation/${sittingId}/hatches`, {
      hatchedOn: today,
      eggsSet: 10,
      liveChicks: 6,
      losses: 2,
      otherCount: 0,
      differenceNote: '',
      batchCode: '',
      birdTypeId: '',
      shedId: '',
    });
    expect(uneven.status).toBe(422);
    const hatched = await send(http, 'post', `/api/v1/farms/${farmId}/incubation/${sittingId}/hatches`, {
      hatchedOn: today,
      eggsSet: 10,
      liveChicks: 6,
      losses: 2,
      otherCount: 2,
      differenceNote: '',
      batchCode: 'C1',
      birdTypeId: type.body.data.id,
      shedId: shed.body.data.id,
    });
    expect(hatched.status).toBe(201);
    expect(hatched.body.data.hatch.chickBatchCode).toBe('C1');
    expect(hatched.body.data.hatch.liveChicks).toBe(6);
    expect(hatched.body.data.proposedHatchRate).toEqual({
      status: 'proposed',
      formula: 'live chicks ÷ eggs set × 100',
      liveChicks: 6,
      eggsSet: 10,
      percent: 60,
    });
    const batch = await http.get(`/api/v1/farms/${farmId}/batches/${hatched.body.data.hatch.chickBatchId}`);
    expect(batch.body.data.batch.liveCount).toBe(6);
    const over = await send(http, 'post', `/api/v1/farms/${farmId}/incubation/${sittingId}/hatches`, {
      hatchedOn: today,
      eggsSet: 1,
      liveChicks: 0,
      losses: 1,
      otherCount: 0,
      differenceNote: '',
      batchCode: '',
      birdTypeId: '',
      shedId: '',
    });
    expect(over.status).toBe(409);
    expect(over.body.error.code).toBe('EGGS_ALREADY_SET');
  });
});
