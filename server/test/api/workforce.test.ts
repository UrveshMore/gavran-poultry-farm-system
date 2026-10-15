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
async function send(http: Http, method: 'post' | 'patch', path: string, body: object) {
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
      'batch_dose_marks', 'medicine_photos', 'farm_schedule_approvals', 'yard_notes', 'report_schedules', 'farm_files', 'notifications', 'sale_returns', 'invoice_lines', 'invoice_documents', 'supplier_payments', 'supplier_bills', 'goods_receipts', 'purchase_order_lines', 'purchase_orders', 'suppliers', 'parentage_records', 'task_training_requirements', 'training_completions', 'training_assignments', 'training_items', 'attendance_records',
      'idempotency_keys', 'audit_logs', 'expense_entries', 'expense_categories', 'order_lines', 'orders', 'market_prices', 'customers',
      'loss_incidents', 'medicine_records', 'health_observations', 'biosecurity_steps', 'knowledge_approvals',
      'growth_weighings', 'growth_targets', 'water_records', 'stock_movements', 'stock_items',
      'task_steps', 'tasks', 'task_template_steps', 'task_templates', 'hatch_records', 'candling_lines', 'candling_records',
      'incubation_batches', 'incubator_readings', 'incubator_maintenance', 'incubators',
      'egg_collection_lines', 'egg_collections', 'egg_categories', 'sex_counts', 'range_areas', 'batch_movements', 'batches', 'bird_types',
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

describe('attendance and training', () => {
  it('counts attendance rows, blocks a task until training is finished, and keeps a worker on their own rows', async () => {
    const http = agent();
    const today = new Date().toISOString().slice(0, 10);
    const registered = await send(http, 'post', '/api/v1/auth/register', {
      email: 'owner@example.com', password, displayName: 'Asha More', preferredLocale: 'en',
    });
    expect(registered.status).toBe(201);
    const ownerId = registered.body.data.user.id as string;
    const farm = await send(http, 'post', '/api/v1/farms', {
      name: 'Gavran Farm', code: 'HOME', timezone: 'UTC', locale: 'en', contactName: '', contactPhone: '',
      contactEmail: '', addressLine: '', weightUnit: 'kg', volumeUnit: 'L',
    });
    const farmId = farm.body.data.id as string;

    const future = await send(http, 'post', `/api/v1/farms/${farmId}/attendance`, {
      userId: '', attendedOn: '2099-01-01', attendedTime: '', methodLabel: 'book', note: '',
    });
    expect(future.status).toBe(422);
    expect(future.body.error.details.fields.attendedOn).toBe('future_date');

    const saved = await send(http, 'post', `/api/v1/farms/${farmId}/attendance`, {
      userId: '', attendedOn: today, attendedTime: '06:30', methodLabel: 'names written in the yard book', note: 'Morning',
    });
    expect(saved.status).toBe(201);
    expect(saved.body.data.methodLabel).toBe('names written in the yard book');
    expect(saved.body.data).not.toHaveProperty('score');

    const listed = await http.get(`/api/v1/farms/${farmId}/attendance`);
    expect(listed.body.data.metric).toEqual({ kind: 'row_count', rowCount: 1 });
    expect(JSON.stringify(listed.body)).not.toMatch(/score|performance/i);

    const item = await send(http, 'post', `/api/v1/farms/${farmId}/training-items`, {
      title: 'Gate latch', body: 'Close the gate after the birds go out.', versionLabel: 'notebook-a',
    });
    expect(item.status).toBe(201);
    const assignment = await send(http, 'post', `/api/v1/farms/${farmId}/training-assignments`, {
      itemId: item.body.data.id, userId: ownerId, dueOn: '2099-06-01',
    });
    expect(assignment.status).toBe(201);
    expect(assignment.body.data.dueOn).toBe('2099-06-01');

    const task = await send(http, 'post', `/api/v1/farms/${farmId}/tasks`, {
      title: 'Open the range gate', dueOn: '2099-06-02', instructions: '', assigneeUserId: ownerId, proofRequired: false, templateId: '',
    });
    expect(task.status).toBe(201);
    const link = await send(http, 'post', `/api/v1/farms/${farmId}/tasks/${task.body.data.id}/training-requirements`, {
      itemId: item.body.data.id,
    });
    expect(link.status).toBe(201);
    const blocked = await send(http, 'post', `/api/v1/farms/${farmId}/tasks/${task.body.data.id}/complete`, { note: '' });
    expect(blocked.status).toBe(409);
    expect(blocked.body.error.code).toBe('TRAINING_REQUIRED');

    const done = await send(http, 'post', `/api/v1/farms/${farmId}/training-assignments/${assignment.body.data.id}/completion`, {
      note: 'I closed the gate twice.',
    });
    expect(done.status).toBe(201);
    const again = await send(http, 'post', `/api/v1/farms/${farmId}/training-assignments/${assignment.body.data.id}/completion`, {
      note: 'again',
    });
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe('TRAINING_ALREADY_DONE');
    const finished = await send(http, 'post', `/api/v1/farms/${farmId}/tasks/${task.body.data.id}/complete`, { note: '' });
    expect(finished.status).toBe(200);

    const invited = await send(http, 'post', `/api/v1/farms/${farmId}/members`, {
      email: 'worker@example.com', displayName: 'Ravi Patil', password: 'worker-password-1', role: 'worker', permissionGrants: [],
    });
    expect(invited.status).toBe(201);
    const worker = agent();
    const loggedIn = await send(worker, 'post', '/api/v1/auth/login', { email: 'worker@example.com', password: 'worker-password-1' });
    expect(loggedIn.status).toBe(200);
    const other = await send(worker, 'post', `/api/v1/farms/${farmId}/attendance`, {
      userId: ownerId, attendedOn: today, attendedTime: '', methodLabel: 'book', note: '',
    });
    expect(other.status).toBe(403);
    const own = await send(worker, 'post', `/api/v1/farms/${farmId}/attendance`, {
      userId: '', attendedOn: today, attendedTime: '', methodLabel: 'told the supervisor', note: '',
    });
    expect(own.status).toBe(201);
    const workerList = await worker.get(`/api/v1/farms/${farmId}/attendance`);
    expect(workerList.body.data.metric.rowCount).toBe(1);
    expect(workerList.body.data.records[0].displayName).toBe('Ravi Patil');
  });
});
