import { createServer, type Server } from 'node:http';
import type { RowDataPacket } from 'mysql2/promise';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { pool } from '../../src/db/pool.js';
import { loginThrottle } from '../../src/modules/auth/service.js';
import { todayInTimeZone } from '../../src/modules/batches/service.js';
import { shiftDate } from '../../src/modules/doses/catalog.js';

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
      'batch_dose_marks', 'medicine_photos', 'farm_schedule_approvals',
      'yard_notes', 'report_schedules', 'farm_files', 'notifications', 'sale_returns', 'invoice_lines', 'invoice_documents', 'supplier_payments', 'supplier_bills', 'goods_receipts', 'purchase_order_lines', 'purchase_orders', 'suppliers', 'parentage_records', 'task_training_requirements', 'training_completions', 'training_assignments', 'training_items', 'attendance_records', 'idempotency_keys',
      'audit_logs', 'expense_entries', 'expense_categories', 'order_lines', 'orders', 'market_prices', 'customers',
      'loss_incidents', 'sex_counts', 'range_areas', 'medicine_records', 'health_observations', 'biosecurity_steps', 'knowledge_approvals',
      'task_steps', 'tasks', 'task_template_steps', 'task_templates', 'membership_permission_grants', 'farm_memberships',
      'sessions', 'password_reset_tokens', 'farms', 'users',
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

describe('chick-day doses', () => {
  it('stays off until the farm checks the paper, then a tick records that day', async () => {
    const http = agent();
    const today = todayInTimeZone('UTC');
    const hatched = shiftDate(today, -2);
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
    const shed = await send(http, 'post', `/api/v1/farms/${farmId}/sheds`, {
      code: 'A1',
      name: 'Brooder',
      shedType: 'brooder',
      usableCapacity: 100,
      status: 'active',
      notes: '',
    });
    const type = await send(http, 'post', `/api/v1/farms/${farmId}/bird-types`, { name: 'Gavran', strainNote: '' });
    const created = await send(http, 'post', `/api/v1/farms/${farmId}/batches`, {
      code: 'D',
      birdTypeId: type.body.data.id,
      sourceNote: 'Sample',
      hatchDate: hatched,
      openedOn: hatched,
      shedId: shed.body.data.id,
      birdCount: 12,
    });
    expect(created.status).toBe(201);
    const batchId = created.body.data.id as string;

    const before = await http.get(`/api/v1/farms/${farmId}/batches/${batchId}/doses`);
    expect(before.status).toBe(200);
    expect(before.body.data.approved).toBe(false);
    expect(before.body.data.paperDay).toBe(3);
    const morning = before.body.data.todayLines.find((line: { slot: string }) => line.slot === 'morning');
    const evening = before.body.data.todayLines.find((line: { slot: string }) => line.slot === 'evening');
    expect(morning.itemName).toContain('Electrolyte');
    expect(morning.amountText).toContain('1 g');
    expect(morning.sourceFile).toBe('patil-poultry-step-by-step-process.pdf');
    expect(morning.sourcePage).toBe(17);
    expect(evening.itemName).toContain('Limcee');
    expect(evening.sourcePage).toBe(17);
    expect(before.body.data.undated.some((line: { itemName: string; unclear: boolean }) => line.unclear && line.itemName.includes('Coryza'))).toBe(true);
    expect(before.body.data.todayLines.some((line: { itemName: string }) => line.itemName.includes('Coryza'))).toBe(false);

    const blocked = await send(http, 'post', `/api/v1/farms/${farmId}/batches/${batchId}/doses`, {
      rowId: morning.rowId,
      givenOn: today,
    });
    expect(blocked.status).toBe(409);
    expect(blocked.body.error.code).toBe('ENTRY_UNAPPROVED');

    const home = await http.get(`/api/v1/farms/${farmId}/dashboard`);
    expect(home.body.data.doses.approved).toBe(false);
    expect(home.body.data.alerts.some((row: { code: string }) => row.code === 'dose_today')).toBe(false);

    const approved = await send(http, 'post', `/api/v1/farms/${farmId}/dose-schedule/approval`, {
      verificationNote: 'Read with the vet. The words are the paper.',
    });
    expect(approved.status).toBe(200);

    const marked = await send(http, 'post', `/api/v1/farms/${farmId}/batches/${batchId}/doses`, {
      rowId: morning.rowId,
      givenOn: today,
    });
    expect(marked.status).toBe(201);
    const again = await send(http, 'post', `/api/v1/farms/${farmId}/batches/${batchId}/doses`, {
      rowId: morning.rowId,
      givenOn: today,
    });
    expect(again.status).toBe(201);
    const [countRows] = await pool.query<RowDataPacket[]>(
      'SELECT COUNT(*) AS n FROM batch_dose_marks WHERE batch_id = ? AND schedule_row_id = ? AND given_on = ?',
      [batchId, morning.rowId, today],
    );
    expect(Number((countRows as RowDataPacket[])[0]?.n)).toBe(1);
    const [medicineRows] = await pool.query<RowDataPacket[]>('SELECT COUNT(*) AS n FROM medicine_records');
    expect(Number((medicineRows as RowDataPacket[])[0]?.n)).toBe(0);

    const after = await http.get(`/api/v1/farms/${farmId}/batches/${batchId}/doses`);
    const givenMorning = after.body.data.todayLines.find((line: { rowId: string }) => line.rowId === morning.rowId);
    expect(givenMorning.given).toBe(true);
    const board = await http.get(`/api/v1/farms/${farmId}/dashboard`);
    const group = board.body.data.doses.groups.find((row: { batchCode: string }) => row.batchCode === 'D');
    expect(group.paperDay).toBe(3);
    expect(group.lines.find((line: { slot: string }) => line.slot === 'morning').given).toBe(true);
    expect(group.lines.find((line: { slot: string }) => line.slot === 'evening').given).toBe(false);
    expect(board.body.data.alerts.some((row: { code: string }) => row.code === 'dose_today')).toBe(true);

    const blank = await send(http, 'post', `/api/v1/farms/${farmId}/batches`, {
      code: 'E',
      birdTypeId: type.body.data.id,
      sourceNote: '',
      hatchDate: '',
      openedOn: today,
      shedId: shed.body.data.id,
      birdCount: 1,
    });
    const undated = await http.get(`/api/v1/farms/${farmId}/batches/${blank.body.data.id}/doses`);
    expect(undated.body.data.paperDay).toBeNull();
    expect(undated.body.data.todayLines).toEqual([]);

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
    expect((await send(worker, 'post', `/api/v1/farms/${farmId}/dose-schedule/approval`, { verificationNote: 'no' })).status).toBe(403);
    const workerMark = await send(worker, 'post', `/api/v1/farms/${farmId}/batches/${batchId}/doses`, {
      rowId: evening.rowId,
      givenOn: today,
    });
    expect(workerMark.status).toBe(201);

    const photo = await http.get(`/api/v1/farms/${farmId}/medicine-photos/electrolyte`);
    expect(photo.status).toBe(200);
    expect(String(photo.headers['content-type'])).toContain('image/png');
  });
});
