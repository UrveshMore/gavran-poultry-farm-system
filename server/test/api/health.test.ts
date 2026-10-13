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
      'supplier_payments', 'supplier_bills', 'goods_receipts', 'purchase_order_lines', 'purchase_orders', 'suppliers', 'parentage_records', 'task_training_requirements', 'training_completions', 'training_assignments', 'training_items', 'attendance_records', 'idempotency_keys',
      'audit_logs',
      'expense_entries',
      'expense_categories',
      'order_lines',
      'orders',
      'market_prices',
      'customers',
      'loss_incidents',
      'sex_counts',
      'range_areas',
      'medicine_records',
      'health_observations',
      'biosecurity_steps',
      'knowledge_approvals',
      'task_steps',
      'tasks',
      'task_template_steps',
      'task_templates',
      'membership_permission_grants',
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

describe('health knowledge base', () => {
  it('keeps every PDF page unapproved until the owner writes a note', async () => {
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

    const columns = await pool.query<RowDataPacket[]>(
      `SELECT column_name AS name FROM information_schema.columns
       WHERE table_schema = DATABASE() AND table_name = 'medicine_records'
         AND column_name IN ('dose', 'dosage', 'withdrawal_until')`,
    );
    expect(columns[0] as RowDataPacket[]).toEqual([]);

    const listed = await http.get(`/api/v1/farms/${farmId}/knowledge`);
    expect(listed.status).toBe(200);
    expect(listed.body.data).toHaveLength(63);
    expect(listed.body.data.every((item: { approved: boolean; mustVerify: boolean; verifyLabel: string }) => !item.approved && item.mustVerify && item.verifyLabel === 'owner/vet must verify before use')).toBe(true);
    const marek = listed.body.data.find((item: { title: string }) => item.title.includes('Mareks Disease'));
    expect(marek).toBeTruthy();
    expect(marek.sourceFile).toBe('patil-poultry-diseases-symptoms-medicines.pdf');
    expect(marek.sourcePage).toBe(2);

    const blocked = await send(http, 'post', `/api/v1/farms/${farmId}/medicine-records`, {
      entryId: marek.id,
      givenOn: today,
      batchId: '',
      notes: 'Given only after the vet looked at the page',
    });
    expect(blocked.status).toBe(409);
    expect(blocked.body.error.code).toBe('ENTRY_UNAPPROVED');
    const taskBlocked = await send(http, 'post', `/api/v1/farms/${farmId}/knowledge/${marek.id}/vaccine-task`, {
      dueOn: today,
      assigneeUserId: '',
    });
    expect(taskBlocked.status).toBe(409);

    const empty = await send(http, 'post', `/api/v1/farms/${farmId}/knowledge/${marek.id}/approval`, {
      approved: true,
      verificationNote: '',
    });
    expect(empty.status).toBe(422);

    const approved = await send(http, 'post', `/api/v1/farms/${farmId}/knowledge/${marek.id}/approval`, {
      approved: true,
      verificationNote: 'Vet confirmed this page on a visit. Follow that written note only.',
    });
    expect(approved.status).toBe(200);
    expect(approved.body.data.approved).toBe(true);

    const given = await send(http, 'post', `/api/v1/farms/${farmId}/medicine-records`, {
      entryId: marek.id,
      givenOn: today,
      batchId: '',
      notes: 'Given only after the vet looked at the page',
    });
    expect(given.status).toBe(201);
    expect(given.body.data).not.toHaveProperty('dose');

    const task = await send(http, 'post', `/api/v1/farms/${farmId}/knowledge/${marek.id}/vaccine-task`, {
      dueOn: today,
      assigneeUserId: '',
    });
    expect(task.status).toBe(201);
    const tasks = await http.get(`/api/v1/farms/${farmId}/tasks`);
    expect(tasks.body.data[0].instructions).toBe('Vet confirmed this page on a visit. Follow that written note only.');

    const copied = await send(http, 'post', `/api/v1/farms/${farmId}/biosecurity-steps`, {
      origin: 'pdf',
      body: 'this client text must be ignored',
      sourceFile: 'patil-poultry-step-by-step-process.pdf',
      sourcePage: 3,
    });
    expect(copied.status).toBe(201);
    expect(copied.body.data.approved).toBe(false);
    expect(copied.body.data.origin).toBe('pdf');
    expect(copied.body.data.sourcePage).toBe(3);
    expect(copied.body.data.body).not.toContain('this client text');
    expect(copied.body.data.mustVerify).toBe(true);

    const wrongFile = await send(http, 'post', `/api/v1/farms/${farmId}/biosecurity-steps`, {
      origin: 'pdf',
      body: '',
      sourceFile: 'patil-poultry-antibiotics.pdf',
      sourcePage: 1,
    });
    expect(wrongFile.status).toBe(422);

    const own = await send(http, 'post', `/api/v1/farms/${farmId}/biosecurity-steps`, {
      origin: 'owner',
      body: 'Footbath at the yard gate',
      sourceFile: '',
      sourcePage: null,
    });
    expect(own.status).toBe(201);
    expect(own.body.data.approved).toBe(true);
    expect(own.body.data.sourcePage).toBeNull();
  });
});
