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

describe('tasks', () => {
  it('starts seasonal checklists empty and refuses a second completion', async () => {
    const http = agent();
    const registered = await send(http, 'post', '/api/v1/auth/register', {
      email: 'owner@example.com',
      password,
      displayName: 'Asha More',
      preferredLocale: 'en',
    });
    expect(registered.status).toBe(201);
    const ownerId = registered.body.data.user.id as string;
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

    const tables = await pool.query<RowDataPacket[]>(
      `SELECT table_name AS name FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name LIKE '%sync%'`,
    );
    expect((tables[0] as RowDataPacket[]).map((row) => String(row.name))).toEqual([]);

    const summer = await send(http, 'post', `/api/v1/farms/${farmId}/task-templates`, { name: 'Summer heat', season: 'summer_heat' });
    expect(summer.status).toBe(201);
    expect(summer.body.data.steps).toEqual([]);
    const again = await send(http, 'post', `/api/v1/farms/${farmId}/task-templates`, { name: 'Heat again', season: 'summer_heat' });
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe('DUPLICATE_CODE');

    const listed = await http.get(`/api/v1/farms/${farmId}/tasks`);
    expect(listed.status).toBe(200);
    expect(listed.body.data).toEqual([]);

    const step = await send(http, 'post', `/api/v1/farms/${farmId}/task-templates/${summer.body.data.id}/steps`, { body: 'Extra shade' });
    expect(step.status).toBe(201);
    expect(step.body.data.steps).toHaveLength(1);
    const skipped = await send(http, 'patch', `/api/v1/farms/${farmId}/task-templates/${summer.body.data.id}/steps/${step.body.data.steps[0].id}`, {
      status: 'skipped',
    });
    expect(skipped.status).toBe(200);

    const fromTemplate = await send(http, 'post', `/api/v1/farms/${farmId}/tasks`, {
      title: 'Check the yard',
      dueOn: '2099-01-01',
      instructions: '',
      assigneeUserId: '',
      proofRequired: false,
      templateId: summer.body.data.id,
    });
    expect(fromTemplate.status).toBe(201);
    expect(fromTemplate.body.data.steps).toEqual([]);
    expect(fromTemplate.body.data.overdue).toBe(false);

    const invited = await send(http, 'post', `/api/v1/farms/${farmId}/members`, {
      email: 'worker@example.com',
      displayName: 'Ravi Patil',
      password: 'worker-password-1',
      role: 'worker',
      permissionGrants: [],
    });
    expect(invited.status).toBe(201);
    const workerId = invited.body.data.member.userId as string;

    const assigned = await send(http, 'post', `/api/v1/farms/${farmId}/tasks`, {
      title: 'Morning round',
      dueOn: '2020-01-01',
      instructions: 'Walk the pens',
      assigneeUserId: workerId,
      proofRequired: true,
      templateId: '',
    });
    expect(assigned.status).toBe(201);
    expect(assigned.body.data.overdue).toBe(true);
    const taskId = assigned.body.data.id as string;

    const missingNote = await send(http, 'post', `/api/v1/farms/${farmId}/tasks/${taskId}/complete`, { note: '' });
    expect(missingNote.status).toBe(422);
    expect(missingNote.body.error.details.fields.note).toBe('required');

    const worker = agent();
    const signedIn = await send(worker, 'post', '/api/v1/auth/login', { email: 'worker@example.com', password: 'worker-password-1' });
    expect(signedIn.status).toBe(200);
    const workerList = await worker.get(`/api/v1/farms/${farmId}/tasks`);
    expect(workerList.status).toBe(200);
    expect(workerList.body.data.map((item: { id: string }) => item.id)).toEqual([taskId]);
    const hidden = await worker.get(`/api/v1/farms/${farmId}/tasks/${fromTemplate.body.data.id}`);
    expect(hidden.status).toBe(404);
    const blocked = await send(worker, 'post', `/api/v1/farms/${farmId}/task-templates`, { name: 'Winter', season: 'winter' });
    expect(blocked.status).toBe(403);

    const done = await send(worker, 'post', `/api/v1/farms/${farmId}/tasks/${taskId}/complete`, { note: 'Pens walked' });
    expect(done.status).toBe(200);
    expect(done.body.data.status).toBe('done');
    expect(done.body.data.completionNote).toBe('Pens walked');
    const twice = await send(worker, 'post', `/api/v1/farms/${farmId}/tasks/${taskId}/complete`, { note: 'Again' });
    expect(twice.status).toBe(409);
    expect(twice.body.error.code).toBe('TASK_ALREADY_DONE');

    const ownerStillSees = await http.get(`/api/v1/farms/${farmId}/tasks/${taskId}`);
    expect(ownerStillSees.status).toBe(200);
    expect(ownerStillSees.body.data.completedAt).toEqual(expect.any(String));
    expect(ownerId).toEqual(expect.any(String));
  });
});
