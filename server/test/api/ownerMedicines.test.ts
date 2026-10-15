import { createServer, type Server } from 'node:http';
import type { RowDataPacket } from 'mysql2/promise';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { OWNER_CITE, SAATHI_VET_LABEL, matchKnowledge } from '@gavran/shared';
import { createApp } from '../../src/app.js';
import { pool } from '../../src/db/pool.js';
import { loginThrottle } from '../../src/modules/auth/service.js';
import { todayInTimeZone } from '../../src/modules/batches/service.js';
import { loadCareEntries } from '../../src/modules/medicines/service.js';

const app = createApp();
let server: Server;
const password = 'correct-horse-battery';
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

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

async function send(http: Http, method: 'post' | 'patch' | 'delete', path: string, body?: object) {
  const token = await csrf(http);
  const req = http[method](path).set('X-CSRF-Token', token);
  return body === undefined ? req : req.send(body);
}

async function truncate(): Promise<void> {
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
      'owner_dose_marks',
      'owner_batch_plans',
      'owner_medicine_links',
      'owner_disease_photos',
      'owner_medicines',
      'owner_diseases',
      'saathi_photos',
      'farm_ai_keys',
      'batch_dose_marks',
      'medicine_photos',
      'farm_schedule_approvals',
      'yard_notes',
      'report_schedules',
      'farm_files',
      'notifications',
      'sale_returns',
      'invoice_lines',
      'invoice_documents',
      'supplier_payments',
      'supplier_bills',
      'goods_receipts',
      'purchase_order_lines',
      'purchase_orders',
      'suppliers',
      'parentage_records',
      'task_training_requirements',
      'training_completions',
      'training_assignments',
      'training_items',
      'attendance_records',
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
      'sex_counts',
      'range_areas',
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

describe('owner medicines', () => {
  it('adds a typed dose, shows it today without the paper, and the assistant cites the owner', async () => {
    const http = agent();
    const today = todayInTimeZone('UTC');
    expect(
      (
        await send(http, 'post', '/api/v1/auth/register', {
          email: 'owner@example.com',
          password,
          displayName: 'Asha More',
          preferredLocale: 'en',
        })
      ).status,
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
      hatchDate: today,
      openedOn: today,
      shedId: shed.body.data.id,
      birdCount: 20,
    });
    expect(created.status).toBe(201);
    const batchId = created.body.data.id as string;
    const blank = await send(http, 'post', `/api/v1/farms/${farmId}/batches`, {
      code: 'E',
      birdTypeId: type.body.data.id,
      sourceNote: '',
      hatchDate: '',
      openedOn: today,
      shedId: shed.body.data.id,
      birdCount: 1,
    });
    expect(blank.status).toBe(201);

    const disease = await send(http, 'post', `/api/v1/farms/${farmId}/owner-diseases`, {
      name: 'Watery eyes',
      symptoms: 'watery eyes and a sneeze',
    });
    expect(disease.status).toBe(201);
    const missingVet = await send(http, 'post', `/api/v1/farms/${farmId}/owner-medicines`, {
      name: 'Tulsi water',
      doseAmount: '5',
      doseUnit: 'ml',
      forBirds: 20,
      route: 'water',
      slot: 'morning',
      ageDayFrom: null,
      ageDayTo: null,
      durationDays: 3,
      notes: 'last summer',
      precaution: '',
      sourceKind: 'vet',
      sourceDetail: '',
      knowledgeEntryIds: [],
      ownerDiseaseIds: [disease.body.data.id],
    });
    expect(missingVet.status).toBe(422);

    const medicine = await send(http, 'post', `/api/v1/farms/${farmId}/owner-medicines`, {
      name: 'Tulsi water',
      doseAmount: '5',
      doseUnit: 'ml',
      forBirds: 20,
      route: 'water',
      slot: 'morning',
      ageDayFrom: null,
      ageDayTo: null,
      durationDays: 3,
      notes: 'last summer',
      precaution: '',
      sourceKind: 'experience',
      sourceDetail: '',
      knowledgeEntryIds: [],
      ownerDiseaseIds: [disease.body.data.id],
    });
    expect(medicine.status).toBe(201);
    expect(medicine.body.data.cite).toBe(OWNER_CITE);
    const medicineId = medicine.body.data.id as string;
    const token = await csrf(http);
    const photo = await http
      .post(`/api/v1/farms/${farmId}/owner-medicines/${medicineId}/photo`)
      .set('X-CSRF-Token', token)
      .attach('file', png, { filename: 'bottle.png', contentType: 'image/png' });
    expect(photo.status).toBe(201);
    expect(typeof photo.body.data.backgroundRemoved).toBe('boolean');
    const diseasePhoto = await http
      .post(`/api/v1/farms/${farmId}/owner-diseases/${disease.body.data.id}/photos`)
      .set('X-CSRF-Token', await csrf(http))
      .attach('file', png, { filename: 'eyes.png', contentType: 'image/png' });
    expect(diseasePhoto.status).toBe(201);

    const blockedAge = await send(http, 'post', `/api/v1/farms/${farmId}/owner-medicines/${medicineId}/plans`, {
      batchId: blank.body.data.id,
      anchor: 'age',
      startOn: null,
      startAgeDay: 1,
      repeatDays: 1,
    });
    expect(blockedAge.status).toBe(422);

    const plan = await send(http, 'post', `/api/v1/farms/${farmId}/owner-medicines/${medicineId}/plans`, {
      batchId,
      anchor: 'date',
      startOn: today,
      startAgeDay: null,
      repeatDays: 1,
    });
    expect(plan.status).toBe(201);
    const planId = plan.body.data.id as string;

    const doses = await http.get(`/api/v1/farms/${farmId}/batches/${batchId}/doses`);
    expect(doses.body.data.approved).toBe(false);
    const line = doses.body.data.todayLines.find((row: { origin: string }) => row.origin === 'owner');
    expect(line.rowId).toBe(planId);
    expect(line.itemName).toBe('Tulsi water');
    expect(line.amountText).toContain('5 ml');
    expect(line.amountText.match(/\d+/g)).toEqual(['5', '20']);
    expect(line.sourceFile).toBe('Added by owner');
    expect(line.given).toBe(false);

    const home = await http.get(`/api/v1/farms/${farmId}/dashboard`);
    expect(home.body.data.doses.approved).toBe(false);
    const group = home.body.data.doses.groups.find((row: { batchCode: string }) => row.batchCode === 'D');
    expect(group.lines.every((row: { origin: string }) => row.origin === 'owner')).toBe(true);
    expect(group.lines.some((row: { given: boolean }) => row.given === false)).toBe(true);
    expect(home.body.data.alerts.some((row: { code: string }) => row.code === 'dose_today')).toBe(true);

    const asked = await send(http, 'post', `/api/v1/farms/${farmId}/saathi/propose`, { text: 'which medicine today' });
    expect(asked.status).toBe(200);
    expect(asked.body.data.speechKey).toBe('saathi.say.doses');
    expect(asked.body.data.vars.list).toContain('Tulsi water');
    expect(asked.body.data.vars.list).toContain('Added by owner');

    const entries = await loadCareEntries(farmId);
    const matches = matchKnowledge('watery eyes and a sneeze', entries);
    expect(matches[0]?.sourceFile).toBe('Added by owner');
    expect(matches[0]?.howToGive).toContain('5 ml');
    expect(matches[0]?.howToGive.match(/\d+/g)).toEqual(['5', '20']);
    expect(matches[0]?.label).toBe(SAATHI_VET_LABEL);
    expect(matches[0]).not.toHaveProperty('dose');

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
    expect(
      (
        await send(worker, 'post', `/api/v1/farms/${farmId}/owner-medicines`, {
          name: 'No',
          doseAmount: '1',
          doseUnit: 'ml',
          forBirds: null,
          route: 'water',
          slot: 'morning',
          ageDayFrom: null,
          ageDayTo: null,
          durationDays: 1,
          notes: '',
          precaution: '',
          sourceKind: 'experience',
          sourceDetail: '',
          knowledgeEntryIds: [],
          ownerDiseaseIds: [disease.body.data.id],
        })
      ).status,
    ).toBe(403);
    const workerMark = await send(worker, 'post', `/api/v1/farms/${farmId}/batches/${batchId}/doses`, { rowId: planId, givenOn: today });
    expect(workerMark.status).toBe(201);
    const again = await send(http, 'post', `/api/v1/farms/${farmId}/batches/${batchId}/doses`, { rowId: planId, givenOn: today });
    expect(again.status).toBe(201);
    const [countRows] = await pool.query<RowDataPacket[]>('SELECT COUNT(*) AS n FROM owner_dose_marks WHERE plan_id = ? AND given_on = ?', [planId, today]);
    expect(Number(countRows[0]?.n)).toBe(1);
    const after = await http.get(`/api/v1/farms/${farmId}/batches/${batchId}/doses`);
    expect(after.body.data.todayLines.find((row: { rowId: string }) => row.rowId === planId).given).toBe(true);

    const patched = await send(http, 'patch', `/api/v1/farms/${farmId}/owner-medicines/${medicineId}`, {
      name: 'Tulsi water cooled',
      doseAmount: '5',
      doseUnit: 'ml',
      forBirds: 20,
      route: 'water',
      slot: 'morning',
      ageDayFrom: null,
      ageDayTo: null,
      durationDays: 3,
      notes: 'last summer',
      precaution: '',
      sourceKind: 'experience',
      sourceDetail: '',
      knowledgeEntryIds: [],
      ownerDiseaseIds: [disease.body.data.id],
    });
    expect(patched.status).toBe(200);
    expect(patched.body.data.name).toBe('Tulsi water cooled');

    const removed = await send(http, 'delete', `/api/v1/farms/${farmId}/owner-medicines/${medicineId}`);
    expect(removed.status).toBe(200);
    const gone = await http.get(`/api/v1/farms/${farmId}/dashboard`);
    expect(gone.body.data.doses.groups.some((row: { batchCode: string }) => row.batchCode === 'D')).toBe(false);
    expect((await loadCareEntries(farmId)).some((entry) => entry.title === 'Tulsi water cooled')).toBe(false);

    const [audits] = await pool.query<RowDataPacket[]>('SELECT action FROM audit_logs WHERE farm_id = ?', [farmId]);
    const actions = new Set(audits.map((row) => String(row.action)));
    expect(actions.has('owner_disease.created')).toBe(true);
    expect(actions.has('owner_medicine.created')).toBe(true);
    expect(actions.has('owner_medicine.attached')).toBe(true);
    expect(actions.has('owner_medicine.updated')).toBe(true);
    expect(actions.has('owner_medicine.deleted')).toBe(true);
    expect(actions.has('dose.marked_given')).toBe(true);
  });
});
