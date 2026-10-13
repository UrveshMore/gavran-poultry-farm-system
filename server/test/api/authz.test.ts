import { createServer, type Server } from 'node:http';
import type { RowDataPacket } from 'mysql2/promise';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ROLE_PERMISSIONS, type FarmRole, type PermissionCode } from '@gavran/shared';
import { createApp } from '../../src/app.js';
import { pool } from '../../src/db/pool.js';
import { loginThrottle } from '../../src/modules/auth/service.js';

const app = createApp();
const ownerPassword = 'correct-horse-battery';
let server: Server;

beforeAll(async () => {
  server = createServer(app);
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });
});

function agent() {
  return request.agent(server);
}

type Http = ReturnType<typeof agent>;

async function csrf(http: Http): Promise<string> {
  const res = await http.get('/api/v1/auth/csrf');
  expect(res.status).toBe(200);
  return res.body.data.csrfToken as string;
}

async function truncate(): Promise<void> {
  const conn = await pool.getConnection();
  try {
    await conn.query('SET FOREIGN_KEY_CHECKS = 0');
    for (const table of [
      'idempotency_keys',
      'audit_logs',
      'membership_permission_grants',
      'sheds',
      'farm_settings',
      'farm_memberships',
      'sessions',
      'password_reset_tokens',
      'egg_collection_lines',
      'egg_collections',
      'egg_categories',
      'batch_movements',
      'batches',
      'bird_types',
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

async function register(http: Http, email = 'owner@example.com', displayName = 'Asha More') {
  const token = await csrf(http);
  return http.post('/api/v1/auth/register').set('X-CSRF-Token', token).send({
    email,
    password: ownerPassword,
    displayName,
    preferredLocale: 'en',
  });
}

async function login(http: Http, email: string, password: string) {
  const token = await csrf(http);
  return http.post('/api/v1/auth/login').set('X-CSRF-Token', token).send({ email, password });
}

async function createFarm(http: Http, code = 'GAVRAN') {
  const token = await csrf(http);
  return http.post('/api/v1/farms').set('X-CSRF-Token', token).send({
    name: 'Gavran Farm',
    code,
    timezone: 'Asia/Kolkata',
    locale: 'mr',
    contactName: 'Asha More',
    contactPhone: '9876543210',
    contactEmail: 'asha@example.com',
    addressLine: 'Village road',
    weightUnit: 'kg',
    volumeUnit: 'L',
  });
}

async function invite(
  http: Http,
  farmId: string,
  body: { email: string; displayName: string; role: string; password?: string; permissionGrants?: string[] },
) {
  const token = await csrf(http);
  return http.post(`/api/v1/farms/${farmId}/members`).set('X-CSRF-Token', token).send({
    password: 'worker-password-1',
    permissionGrants: [],
    ...body,
  });
}

function cookie(res: request.Response, name: string): string {
  const raw = res.headers['set-cookie'];
  const list = Array.isArray(raw) ? raw : [];
  const line = list.find((item) => item.startsWith(`${name}=`));
  expect(line, name).toBeTruthy();
  return line?.split(';')[0]?.slice(name.length + 1) ?? '';
}

beforeEach(async () => {
  await truncate();
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
});

describe('authentication', () => {
  it('requires a CSRF token and does not put session tokens in the body', async () => {
    const http = agent();
    const missing = await http.post('/api/v1/auth/register').send({
      email: 'owner@example.com',
      password: ownerPassword,
      displayName: 'Asha More',
      preferredLocale: 'en',
    });
    expect(missing.status).toBe(403);
    expect(missing.body.error.code).toBe('CSRF_INVALID');

    const created = await register(http);
    expect(created.status).toBe(201);
    expect(created.body.data.user.email).toBe('owner@example.com');
    expect(created.body.data.accessToken).toBeUndefined();
    expect(created.body.data.refreshToken).toBeUndefined();
    expect(JSON.stringify(created.body)).not.toContain('passwordHash');
    const setCookie = created.headers['set-cookie'];
    const cookieLines = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
    const access = cookieLines.find((item) => item.startsWith('gavran_access='));
    const refresh = cookieLines.find((item) => item.startsWith('gavran_refresh='));
    expect(access).toContain('HttpOnly');
    expect(refresh).toContain('HttpOnly');

    const closed = await register(agent(), 'other@example.com');
    expect(closed.status).toBe(403);
    expect(closed.body.error.code).toBe('BOOTSTRAP_CLOSED');
    expect((await http.get('/api/v1/health')).status).toBe(200);
  });

  it('rejects bad passwords, deactivated accounts, logout, and reused refresh tokens', async () => {
    const owner = agent();
    const registered = await register(owner);
    expect(registered.status).toBe(201);

    const bad = await login(agent(), 'owner@example.com', 'not-the-password');
    expect(bad.status).toBe(401);
    expect(bad.body.error.code).toBe('AUTH_INVALID_CREDENTIALS');

    const farm = await createFarm(owner);
    const farmId = farm.body.data.id as string;
    const invited = await invite(owner, farmId, {
      email: 'worker@example.com',
      displayName: 'Ravi Patil',
      role: 'worker',
    });
    expect(invited.status).toBe(201);
    const membershipId = invited.body.data.member.id as string;
    const token = await csrf(owner);
    const deactivated = await owner
      .patch(`/api/v1/farms/${farmId}/members/${membershipId}`)
      .set('X-CSRF-Token', token)
      .send({ deactivateUser: true });
    expect(deactivated.status).toBe(200);

    const blocked = await login(agent(), 'worker@example.com', 'worker-password-1');
    expect(blocked.status).toBe(403);
    expect(blocked.body.error.code).toBe('ACCOUNT_DEACTIVATED');
    const hidden = await login(agent(), 'worker@example.com', 'wrong-password-xx');
    expect(hidden.status).toBe(401);

    const oldRefresh = cookie(registered, 'gavran_refresh');
    const refreshed = await owner.post('/api/v1/auth/refresh').set('X-CSRF-Token', await csrf(owner));
    expect(refreshed.status).toBe(200);
    const reused = await request(server)
      .post('/api/v1/auth/refresh')
      .set('Cookie', `gavran_refresh=${oldRefresh}; gavran_csrf=${refreshed.body.data.csrfToken}`)
      .set('X-CSRF-Token', refreshed.body.data.csrfToken as string);
    expect(reused.status).toBe(401);
    const afterReuse = await owner.post('/api/v1/auth/refresh').set('X-CSRF-Token', await csrf(owner));
    expect(afterReuse.status).toBe(401);

    const again = agent();
    expect((await login(again, 'owner@example.com', ownerPassword)).status).toBe(200);
    const other = agent();
    expect((await login(other, 'owner@example.com', ownerPassword)).status).toBe(200);
    const changed = await again.post('/api/v1/auth/change-password').set('X-CSRF-Token', await csrf(again)).send({
      currentPassword: ownerPassword,
      newPassword: 'a-new-password-value',
    });
    expect(changed.status).toBe(200);
    expect((await other.get('/api/v1/auth/me')).status).toBe(401);
    expect((await again.get('/api/v1/auth/me')).status).toBe(200);
    expect((await again.post('/api/v1/auth/logout').set('X-CSRF-Token', await csrf(again))).status).toBe(200);
    expect((await again.get('/api/v1/auth/me')).status).toBe(401);
    expect((await agent().get('/api/v1/farms')).status).toBe(401);
  });
});

describe('authorization and farm scope', () => {
  it('matches the seeded role matrix and enforces farm scope', async () => {
    const [rows] = await pool.query<Array<RowDataPacket & { role_code: string; permission_code: string | null }>>(
      `SELECT r.code AS role_code, p.code AS permission_code
       FROM roles r
       LEFT JOIN role_permissions rp ON rp.role_id = r.id
       LEFT JOIN permissions p ON p.id = rp.permission_id`,
    );
    const actual = new Map<string, string[]>();
    for (const row of rows) {
      const list = actual.get(row.role_code) ?? [];
      if (row.permission_code) list.push(row.permission_code);
      actual.set(row.role_code, list);
    }
    for (const [role, expected] of Object.entries(ROLE_PERMISSIONS) as Array<[FarmRole | 'system_administrator', readonly PermissionCode[]]>) {
      expect((actual.get(role) ?? []).sort()).toEqual([...expected].sort());
    }

    const owner = agent();
    expect((await register(owner)).status).toBe(201);
    const farmRes = await createFarm(owner, 'HOME');
    expect(farmRes.status).toBe(201);
    const farmId = farmRes.body.data.id as string;
    expect(farmRes.body.data.role).toBe('owner');

    const workerInvite = await invite(owner, farmId, {
      email: 'worker@example.com',
      displayName: 'Ravi Patil',
      role: 'worker',
    });
    const managerInvite = await invite(owner, farmId, {
      email: 'manager@example.com',
      displayName: 'Meera Kulkarni',
      role: 'manager',
    });
    const helperInvite = await invite(owner, farmId, {
      email: 'family@example.com',
      displayName: 'Family Helper',
      role: 'family_helper',
      permissionGrants: [],
    });
    const readerInvite = await invite(owner, farmId, {
      email: 'reader@example.com',
      displayName: 'Granted Helper',
      role: 'family_helper',
      permissionGrants: ['shed.read'],
    });
    expect(workerInvite.status).toBe(201);
    expect(managerInvite.status).toBe(201);
    expect(helperInvite.status).toBe(201);
    expect(readerInvite.status).toBe(201);

    const worker = agent();
    expect((await login(worker, 'worker@example.com', 'worker-password-1')).status).toBe(200);
    const manager = agent();
    expect((await login(manager, 'manager@example.com', 'worker-password-1')).status).toBe(200);
    const helper = agent();
    expect((await login(helper, 'family@example.com', 'worker-password-1')).status).toBe(200);
    const reader = agent();
    expect((await login(reader, 'reader@example.com', 'worker-password-1')).status).toBe(200);

    expect((await worker.post('/api/v1/farms').set('X-CSRF-Token', await csrf(worker)).send({
      name: 'Shadow Farm',
      code: 'SHADOW',
      timezone: 'Asia/Kolkata',
      locale: 'en',
      contactName: '',
      contactPhone: '',
      contactEmail: '',
      addressLine: '',
      weightUnit: 'kg',
      volumeUnit: 'L',
    })).status).toBe(403);

    const shedBody = {
      code: 'B1',
      name: 'Brooder one',
      shedType: 'brooder',
      usableCapacity: 200,
      status: 'active',
      notes: "'; DROP TABLE sheds; --",
    };
    expect((await worker.post(`/api/v1/farms/${farmId}/sheds`).set('X-CSRF-Token', await csrf(worker)).send(shedBody)).status).toBe(403);
    expect((await worker.get(`/api/v1/farms/${farmId}/members`)).status).toBe(403);
    expect((await worker.get(`/api/v1/farms/${farmId}/audit`)).status).toBe(403);
    expect((await worker.get(`/api/v1/farms/${farmId}/sheds`)).status).toBe(200);

    const createdShed = await manager
      .post(`/api/v1/farms/${farmId}/sheds`)
      .set('X-CSRF-Token', await csrf(manager))
      .set('Idempotency-Key', 'shed-create-key-1')
      .send(shedBody);
    expect(createdShed.status).toBe(201);
    const replay = await manager
      .post(`/api/v1/farms/${farmId}/sheds`)
      .set('X-CSRF-Token', await csrf(manager))
      .set('Idempotency-Key', 'shed-create-key-1')
      .send({ ...shedBody, name: 'Different name' });
    expect(replay.status).toBe(201);
    expect(replay.body.data.id).toBe(createdShed.body.data.id);
    expect(replay.body.data.name).toBe('Brooder one');
    const listed = await worker.get(`/api/v1/farms/${farmId}/sheds`);
    expect(listed.body.data).toHaveLength(1);
    expect(listed.body.data[0].notes).toContain('DROP TABLE');

    expect((await manager.patch(`/api/v1/farms/${farmId}`).set('X-CSRF-Token', await csrf(manager)).send({
      version: 1,
      name: 'Changed by manager',
    })).status).toBe(403);
    expect((await manager.post(`/api/v1/farms/${farmId}/members`).set('X-CSRF-Token', await csrf(manager)).send({
      email: 'extra@example.com',
      displayName: 'Extra Person',
      password: 'worker-password-1',
      role: 'worker',
      permissionGrants: [],
    })).status).toBe(403);
    expect((await manager.get(`/api/v1/farms/${farmId}/audit`)).status).toBe(200);
    expect((await manager.get(`/api/v1/farms/${farmId}/members`)).status).toBe(200);

    expect((await helper.get(`/api/v1/farms/${farmId}/sheds`)).status).toBe(403);
    expect((await reader.get(`/api/v1/farms/${farmId}/sheds`)).status).toBe(200);
    expect((await reader.post(`/api/v1/farms/${farmId}/sheds`).set('X-CSRF-Token', await csrf(reader)).send(shedBody)).status).toBe(403);

    const negative = await owner.post(`/api/v1/farms/${farmId}/sheds`).set('X-CSRF-Token', await csrf(owner)).send({
      ...shedBody,
      code: 'B2',
      usableCapacity: -5,
    });
    expect(negative.status).toBe(422);
    const duplicate = await owner.post(`/api/v1/farms/${farmId}/sheds`).set('X-CSRF-Token', await csrf(owner)).send(shedBody);
    expect(duplicate.status).toBe(409);

    const stale = await owner
      .patch(`/api/v1/farms/${farmId}/sheds/${createdShed.body.data.id}`)
      .set('X-CSRF-Token', await csrf(owner))
      .send({ version: 1, name: 'Brooder renamed' });
    expect(stale.status).toBe(200);
    const conflict = await owner
      .patch(`/api/v1/farms/${farmId}/sheds/${createdShed.body.data.id}`)
      .set('X-CSRF-Token', await csrf(owner))
      .send({ version: 1, name: 'Again' });
    expect(conflict.status).toBe(409);

    const second = await createFarm(owner, 'NORTH');
    expect(second.status).toBe(201);
    expect((await worker.get(`/api/v1/farms/${second.body.data.id}/sheds`)).status).toBe(404);
    expect((await worker.get('/api/v1/farms/00000000-0000-4000-8000-000000009999/sheds')).status).toBe(404);

    const self = (await owner.get(`/api/v1/farms/${farmId}/members`)).body.data as Array<{ id: string; email: string }>;
    const ownerMembership = self.find((member) => member.email === 'owner@example.com');
    const last = await owner
      .patch(`/api/v1/farms/${farmId}/members/${ownerMembership?.id}`)
      .set('X-CSRF-Token', await csrf(owner))
      .send({ status: 'revoked' });
    expect(last.status).toBe(409);
    expect(last.body.error.code).toBe('LAST_OWNER');

    const secondOwner = await invite(owner, farmId, {
      email: 'second@example.com',
      displayName: 'Second Owner',
      role: 'owner',
      password: 'second-owner-pass',
    });
    expect(secondOwner.status).toBe(201);
    const steppedDown = await owner
      .patch(`/api/v1/farms/${farmId}/members/${ownerMembership?.id}`)
      .set('X-CSRF-Token', await csrf(owner))
      .send({ status: 'revoked' });
    expect(steppedDown.status).toBe(200);

    const outsider = agent();
    expect((await register(outsider, 'outsider@example.com', 'Outsider')).status).toBe(403);
    await pool.query(`UPDATE users SET platform_role = 'system_administrator' WHERE email = 'worker@example.com'`);
    await pool.query(`DELETE FROM farm_memberships WHERE user_id = (SELECT id FROM users WHERE email = 'worker@example.com')`);
    const admin = agent();
    expect((await login(admin, 'worker@example.com', 'worker-password-1')).status).toBe(200);
    expect((await admin.get(`/api/v1/farms/${farmId}/sheds`)).status).toBe(404);

    const [auditRows] = await pool.query<RowDataPacket[]>('SELECT action, summary FROM audit_logs');
    const blob = JSON.stringify(auditRows);
    expect(blob).not.toContain(ownerPassword);
    expect(blob).not.toContain('worker-password-1');
    expect(blob).toContain('farm.created');
  });
});
