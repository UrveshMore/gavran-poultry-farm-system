import { createServer, type Server } from 'node:http';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { pool } from '../../src/db/pool.js';
import { loginThrottle } from '../../src/modules/auth/service.js';

const app = createApp();
let server: Server;
const password = 'correct-horse-battery';
const mobile = '9876543210';
const pin = '482913';

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
      'yard_notes', 'report_schedules', 'farm_files', 'notifications',
      'sale_returns', 'invoice_lines', 'invoice_documents',
      'supplier_payments', 'supplier_bills', 'goods_receipts', 'purchase_order_lines', 'purchase_orders', 'suppliers',
      'parentage_records',
      'task_training_requirements', 'training_completions', 'training_assignments', 'training_items', 'attendance_records',
      'idempotency_keys', 'audit_logs', 'expense_entries', 'expense_categories', 'order_lines', 'orders', 'market_prices', 'customers',
      'loss_incidents', 'medicine_records', 'health_observations', 'biosecurity_steps', 'knowledge_approvals',
      'growth_weighings', 'growth_targets', 'water_records', 'stock_movements', 'stock_items',
      'task_steps', 'tasks', 'task_template_steps', 'task_templates', 'hatch_records', 'candling_lines', 'candling_records',
      'incubation_batches', 'incubator_readings', 'incubator_maintenance', 'incubators',
      'egg_collection_lines', 'egg_collections', 'egg_categories', 'sex_counts', 'range_areas', 'batch_movements', 'batches', 'bird_types',
      'membership_permission_grants', 'sheds', 'farm_settings', 'farm_memberships', 'sessions', 'password_reset_tokens', 'farms', 'users',
    ]) await conn.query(`TRUNCATE TABLE \`${table}\``);
    await conn.query('SET FOREIGN_KEY_CHECKS = 1');
  } finally {
    conn.release();
  }
  loginThrottle.reset();
});

const farmBody = {
  name: 'Gavran Farm', code: 'HOME', timezone: 'UTC', locale: 'en', contactName: '', contactPhone: '',
  contactEmail: '', addressLine: '', weightUnit: 'kg', volumeUnit: 'L',
};

describe('worker PIN sign-in', () => {
  it('lets a worker sign in with a mobile number and a PIN, and locks out after five failures', async () => {
    const owner = agent();
    expect((await send(owner, 'post', '/api/v1/auth/register', {
      email: 'owner@example.com', password, displayName: 'Asha More', preferredLocale: 'en',
    })).status).toBe(201);
    const farm = await send(owner, 'post', '/api/v1/farms', farmBody);
    const farmId = farm.body.data.id as string;

    const created = await send(owner, 'post', `/api/v1/farms/${farmId}/members/pin`, {
      displayName: 'Ravi Patil', mobile: '98765 43210', pin, role: 'worker',
    });
    expect(created.status).toBe(201);
    expect(created.body.data.userCreated).toBe(true);
    expect(created.body.data.member.mobile).toBe(mobile);
    expect(created.body.data.member.email).toBeNull();
    expect(created.body.data.member.role).toBe('worker');
    const body = JSON.stringify(created.body);
    expect(body).not.toContain(pin);
    expect(body).not.toContain('pinHash');
    expect(body).not.toContain('pin_hash');
    const membershipId = created.body.data.member.id as string;

    const again = await send(owner, 'post', `/api/v1/farms/${farmId}/members/pin`, {
      displayName: 'Ravi Again', mobile, pin: '1111', role: 'worker',
    });
    expect(again.status).toBe(409);

    const ownerRole = await send(owner, 'post', `/api/v1/farms/${farmId}/members/pin`, {
      displayName: 'Not An Owner', mobile: '9000000001', pin: '2222', role: 'owner',
    });
    expect(ownerRole.status).toBe(422);

    const ownerStill = await send(owner, 'post', '/api/v1/auth/login', { email: 'owner@example.com', password });
    expect(ownerStill.status).toBe(200);

    const worker = agent();
    const wrong = await send(worker, 'post', '/api/v1/auth/pin-login', { mobile, pin: '0000' });
    expect(wrong.status).toBe(401);
    expect(wrong.body.error.code).toBe('AUTH_INVALID_CREDENTIALS');
    for (let attempt = 0; attempt < 4; attempt += 1) {
      expect((await send(worker, 'post', '/api/v1/auth/pin-login', { mobile, pin: '0000' })).status).toBe(401);
    }
    const locked = await send(worker, 'post', '/api/v1/auth/pin-login', { mobile, pin });
    expect(locked.status).toBe(429);
    expect(locked.body.error.code).toBe('RATE_LIMITED');

    loginThrottle.reset();
    const signedIn = await send(worker, 'post', '/api/v1/auth/pin-login', { mobile, pin });
    expect(signedIn.status).toBe(200);
    expect(signedIn.body.data.user.displayName).toBe('Ravi Patil');
    expect(signedIn.body.data.user.mobile).toBe(mobile);
    expect(JSON.stringify(signedIn.body)).not.toContain(pin);
    expect((await worker.get('/api/v1/auth/me')).status).toBe(200);

    const workerReset = await send(worker, 'post', `/api/v1/farms/${farmId}/members/${membershipId}/pin`, { pin: '135790' });
    expect(workerReset.status).toBe(403);

    const managerInvite = await send(owner, 'post', `/api/v1/farms/${farmId}/members`, {
      email: 'manager@example.com', displayName: 'Meera Kulkarni', password: 'manager-password-1', role: 'manager', permissionGrants: [],
    });
    expect(managerInvite.status).toBe(201);
    const manager = agent();
    expect((await send(manager, 'post', '/api/v1/auth/login', {
      email: 'manager@example.com', password: 'manager-password-1',
    })).status).toBe(200);
    const managerCreate = await send(manager, 'post', `/api/v1/farms/${farmId}/members/pin`, {
      displayName: 'Sita', mobile: '9000000002', pin: '2468', role: 'worker',
    });
    expect(managerCreate.status).toBe(403);
    const reset = await send(manager, 'post', `/api/v1/farms/${farmId}/members/${membershipId}/pin`, { pin: '135790' });
    expect(reset.status).toBe(200);
    expect(JSON.stringify(reset.body)).not.toContain('135790');
    expect((await worker.get('/api/v1/auth/me')).status).toBe(401);
    expect((await send(worker, 'post', '/api/v1/auth/pin-login', { mobile, pin })).status).toBe(401);
    expect((await send(worker, 'post', '/api/v1/auth/pin-login', { mobile, pin: '135790' })).status).toBe(200);

    const second = await send(owner, 'post', '/api/v1/farms', { ...farmBody, name: 'North Yard', code: 'NORTH' });
    expect(second.status).toBe(201);
    const linked = await send(owner, 'post', `/api/v1/farms/${second.body.data.id as string}/members/pin`, {
      displayName: 'Other Name', mobile, pin: '9999', role: 'worker',
    });
    expect(linked.status).toBe(201);
    expect(linked.body.data.userCreated).toBe(false);
    expect(linked.body.data.member.displayName).toBe('Ravi Patil');
    expect((await send(agent(), 'post', '/api/v1/auth/pin-login', { mobile, pin: '9999' })).status).toBe(401);
    expect((await send(agent(), 'post', '/api/v1/auth/pin-login', { mobile, pin: '135790' })).status).toBe(200);

    expect((await send(owner, 'patch', `/api/v1/farms/${farmId}/members/${membershipId}`, { deactivateUser: true })).status).toBe(200);
    const blocked = await send(agent(), 'post', '/api/v1/auth/pin-login', { mobile, pin: '135790' });
    expect(blocked.status).toBe(403);
    expect(blocked.body.error.code).toBe('ACCOUNT_DEACTIVATED');
  });
});
