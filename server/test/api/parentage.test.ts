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
      'batch_dose_marks', 'medicine_photos', 'farm_schedule_approvals', 'yard_notes', 'report_schedules', 'farm_files', 'notifications', 'sale_returns', 'invoice_lines', 'invoice_documents', 'supplier_payments', 'supplier_bills', 'goods_receipts', 'purchase_order_lines', 'purchase_orders', 'suppliers', 'parentage_records',
      'task_training_requirements', 'training_completions', 'training_assignments', 'training_items', 'attendance_records',
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

describe('parentage', () => {
  it('stores the sire and dam the farm types and does not suggest a pairing', async () => {
    const http = agent();
    const today = new Date().toISOString().slice(0, 10);
    expect((await send(http, 'post', '/api/v1/auth/register', {
      email: 'owner@example.com', password, displayName: 'Asha More', preferredLocale: 'en',
    })).status).toBe(201);
    const farm = await send(http, 'post', '/api/v1/farms', {
      name: 'Gavran Farm', code: 'HOME', timezone: 'UTC', locale: 'en', contactName: '', contactPhone: '',
      contactEmail: '', addressLine: '', weightUnit: 'kg', volumeUnit: 'L',
    });
    const farmId = farm.body.data.id as string;
    const shed = await send(http, 'post', `/api/v1/farms/${farmId}/sheds`, {
      code: 'Y1', name: 'Yard', shedType: 'other', usableCapacity: 30, status: 'active', notes: '',
    });
    const bird = await send(http, 'post', `/api/v1/farms/${farmId}/bird-types`, { name: 'Desi', strainNote: '' });
    const dam = await send(http, 'post', `/api/v1/farms/${farmId}/batches`, {
      code: 'HENS', birdTypeId: bird.body.data.id, sourceNote: '', hatchDate: '', openedOn: today,
      shedId: shed.body.data.id, birdCount: 5,
    });
    const chicks = await send(http, 'post', `/api/v1/farms/${farmId}/batches`, {
      code: 'CHICKS', birdTypeId: bird.body.data.id, sourceNote: '', hatchDate: '', openedOn: today,
      shedId: shed.body.data.id, birdCount: 8,
    });
    const empty = await send(http, 'post', `/api/v1/farms/${farmId}/parentage`, {
      recordedOn: today, offspringBatchId: '', sireNote: '', damNote: '', sireBatchId: '', damBatchId: '', note: '',
    });
    expect(empty.status).toBe(422);
    expect(empty.body.error.details.fields.sireNote).toBe('required');
    const missing = await send(http, 'post', `/api/v1/farms/${farmId}/parentage`, {
      recordedOn: today, offspringBatchId: '', sireNote: 'red rooster', damNote: '',
      sireBatchId: '', damBatchId: '00000000-0000-4000-8000-000000000099', note: '',
    });
    expect(missing.status).toBe(422);
    expect(missing.body.error.details.fields.damBatchId).toBe('invalid_format');

    const saved = await send(http, 'post', `/api/v1/farms/${farmId}/parentage`, {
      recordedOn: today, offspringBatchId: chicks.body.data.id, sireNote: 'red rooster in the yard', damNote: '',
      sireBatchId: '', damBatchId: dam.body.data.id, note: 'Hatched under the broody hen.',
    });
    expect(saved.status).toBe(201);
    expect(saved.body.data.sireNote).toBe('red rooster in the yard');
    expect(saved.body.data.damCode).toBe('HENS');
    expect(saved.body.data.offspringCode).toBe('CHICKS');
    expect(saved.body.data).not.toHaveProperty('coefficient');

    const listed = await http.get(`/api/v1/farms/${farmId}/parentage`);
    expect(listed.body.data.pairing).toEqual({ status: 'unset' });
    expect(JSON.stringify(listed.body)).not.toMatch(/inbreeding|coefficient|recommended/i);
  });
});
