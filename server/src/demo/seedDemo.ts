import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { RowDataPacket } from 'mysql2/promise';
import { exec, one, type Db, type SqlValue } from '../db/sql.js';
import { withTransaction } from '../db/transaction.js';
import { writeAudit } from '../modules/audit/repository.js';
import { findUserByEmail, findUserByMobile, insertPinUser, insertUser, updatePassword, updatePinHash } from '../modules/auth/repository.js';
import { insertBatch, insertBirdType, insertMovement, insertRangeArea, insertSexCount } from '../modules/batches/repository.js';
import { todayInTimeZone } from '../modules/batches/service.js';
import { insertEggCategory, insertCollection } from '../modules/eggs/repository.js';
import { insertCategory, insertEntry } from '../modules/expenses/repository.js';
import { insertFarm, insertMembership, insertShed } from '../modules/farms/repository.js';
import { insertHatch } from '../modules/hatch/repository.js';
import { insertBiosecurity, insertMedicine, insertObservation, saveApproval } from '../modules/health/repository.js';
import { insertCandling, insertSitting } from '../modules/incubation/repository.js';
import { insertIncubator, insertMaintenance, insertReading } from '../modules/incubators/repository.js';
import { insertDocument, insertReturn } from '../modules/invoices/repository.js';
import { insertIncident } from '../modules/losses/repository.js';
import { insertNotice } from '../modules/notifications/repository.js';
import { insertParentage } from '../modules/parentage/repository.js';
import { insertCustomer, insertOrder as insertSaleOrder, insertPrice } from '../modules/sales/repository.js';
import { insertSchedule } from '../modules/schedules/repository.js';
import { insertItem as insertStockItem, insertMovement as insertStockMovement, insertTarget, insertWater, insertWeighing } from '../modules/stock/repository.js';
import { insertBill, insertOrder as insertPurchaseOrder, insertPayment, insertReceipt, insertSupplier } from '../modules/suppliers/repository.js';
import { completeTask, insertStep, insertTask, insertTemplate } from '../modules/tasks/repository.js';
import { insertAssignment, insertAttendance, insertCompletion, insertItem as insertTraining } from '../modules/workforce/repository.js';
import { insertNote } from '../modules/yard/repository.js';
import { insertFile } from '../modules/documents/repository.js';
import { hashPassword } from '../security/password.js';

/** Local demo only. Shorter than the sign-up rule on purpose. */
export const DEMO_ADMIN_EMAIL = 'admin@gmail.com';
export const DEMO_ADMIN_PASSWORD = 'admin@123';
export const DEMO_FARM_CODE = 'DEMO';
export const DEMO_MANAGER_EMAIL = 'meera.demo@gmail.com';
export const DEMO_MANAGER_PASSWORD = 'manager-demo-1';
export const DEMO_WORKERS = [
  { name: 'Sample Lata', mobile: '9811100011', pin: '2468', role: 'worker' as const },
  { name: 'Sample Raju', mobile: '9811100022', pin: '1357', role: 'worker' as const },
];

const ZONE = 'Asia/Kolkata';

export function assertDemoSeedAllowed(nodeEnv: string): void {
  if (nodeEnv === 'production') {
    throw new Error('Refusing demo seed when NODE_ENV=production. This command is for a local computer only.');
  }
}

function shiftDate(iso: string, days: number): string {
  const [year, month, day] = iso.split('-').map(Number);
  const date = new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

async function findId(db: Db, sql: string, params: SqlValue[]): Promise<string | null> {
  const row = await one<RowDataPacket & { id: string }>(db, sql, params);
  return row?.id ?? null;
}

async function ensureUser(
  db: Db,
  input: { email: string; displayName: string; passwordHash: string },
): Promise<string> {
  const existing = await findUserByEmail(db, input.email);
  if (existing) {
    await updatePassword(db, existing.id, input.passwordHash);
    return existing.id;
  }
  const created = await insertUser(db, {
    email: input.email,
    displayName: input.displayName,
    passwordHash: input.passwordHash,
    preferredLocale: 'en',
  });
  return created.id;
}

async function ensurePinUser(
  db: Db,
  input: { displayName: string; mobile: string; pinHash: string },
): Promise<string> {
  const existing = await findUserByMobile(db, input.mobile);
  if (existing) {
    await updatePinHash(db, existing.id, input.pinHash);
    return existing.id;
  }
  const created = await insertPinUser(db, {
    displayName: input.displayName,
    mobile: input.mobile,
    pinHash: input.pinHash,
    preferredLocale: 'en',
  });
  return created.id;
}

async function ensureMember(db: Db, farmId: string, userId: string, role: 'owner' | 'manager' | 'worker', createdBy: string) {
  const existing = await findId(db, 'SELECT id FROM farm_memberships WHERE farm_id = ? AND user_id = ?', [farmId, userId]);
  if (existing) return existing;
  return insertMembership(db, { farmId, userId, role, createdBy });
}

export async function seedDemo(): Promise<string> {
  const today = todayInTimeZone(ZONE);
  const day = (offset: number) => shiftDate(today, offset);
  const adminHash = await hashPassword(DEMO_ADMIN_PASSWORD);
  const managerHash = await hashPassword(DEMO_MANAGER_PASSWORD);
  const pinHashes = await Promise.all(DEMO_WORKERS.map((worker) => hashPassword(worker.pin)));

  const farmId = await withTransaction(async (db) => {
    const adminId = await ensureUser(db, {
      email: DEMO_ADMIN_EMAIL,
      displayName: 'Sample Admin',
      passwordHash: adminHash,
    });
    const managerId = await ensureUser(db, {
      email: DEMO_MANAGER_EMAIL,
      displayName: 'Sample Meera',
      passwordHash: managerHash,
    });
    const workers: Array<{ id: string; name: string }> = [];
    for (let index = 0; index < DEMO_WORKERS.length; index += 1) {
      const worker = DEMO_WORKERS[index];
      if (!worker) continue;
      const id = await ensurePinUser(db, {
        displayName: worker.name,
        mobile: worker.mobile,
        pinHash: pinHashes[index] ?? '',
      });
      workers.push({ id, name: worker.name });
    }

    let farm = await findId(db, 'SELECT id FROM farms WHERE code = ?', [DEMO_FARM_CODE]);
    if (!farm) {
      const created = await insertFarm(db, {
        name: 'Sample Gavran Farm',
        code: DEMO_FARM_CODE,
        timezone: ZONE,
        locale: 'en',
        contactName: 'Sample Admin',
        contactPhone: '9811100000',
        contactEmail: DEMO_ADMIN_EMAIL,
        addressLine: 'Sample plot, near the mango trees, Satara',
        weightUnit: 'kg',
        volumeUnit: 'L',
        createdBy: adminId,
      });
      farm = created.id;
    }
    const farmIdInner = farm;
    await ensureMember(db, farmIdInner, adminId, 'owner', adminId);
    await ensureMember(db, farmIdInner, managerId, 'manager', adminId);
    for (const worker of workers) await ensureMember(db, farmIdInner, worker.id, 'worker', adminId);

    const shed = async (code: string, name: string, shedType: 'brooder' | 'grower' | 'layer', capacity: number) => {
      const existing = await findId(db, 'SELECT id FROM sheds WHERE farm_id = ? AND code = ?', [farmIdInner, code]);
      if (existing) return existing;
      const row = await insertShed(db, {
        farmId: farmIdInner,
        code,
        name,
        shedType,
        usableCapacity: capacity,
        capacityUnit: 'birds',
        status: 'active',
        notes: 'Sample shed. The bird count is what you type, not a stocking rule.',
        createdBy: adminId,
      });
      return row.id;
    };
    const brooder = await shed('BR', 'Sample brooder', 'brooder', 80);
    const grower = await shed('GR', 'Sample grower shed', 'grower', 60);
    const layer = await shed('LY', 'Sample layer shed', 'layer', 50);

    const birdType = async (name: string, strain: string) => {
      const existing = await findId(db, 'SELECT id FROM bird_types WHERE farm_id = ? AND name = ?', [farmIdInner, name]);
      if (existing) return existing;
      const row = await insertBirdType(db, farmIdInner, name, strain, adminId);
      return row.id;
    };
    const desi = await birdType('Sample desi', 'Sample: village mix, not a catalogue breed');
    const kadak = await birdType('Sample kadaknath', 'Sample: dark feathers, owner typed');
    const aseel = await birdType('Sample aseel cross', 'Sample: fighting-hen cross, owner typed');

    const batch = async (input: {
      code: string;
      typeId: string;
      shedId: string;
      hatch: string;
      opened: string;
      birds: number;
      source: string;
    }) => {
      const existing = await findId(db, 'SELECT id FROM batches WHERE farm_id = ? AND code = ?', [farmIdInner, input.code]);
      if (existing) return existing;
      return insertBatch(db, {
        farmId: farmIdInner,
        code: input.code,
        birdTypeId: input.typeId,
        sourceNote: input.source,
        hatchDate: input.hatch,
        openedOn: input.opened,
        shedId: input.shedId,
        birdCount: input.birds,
        createdBy: adminId,
      });
    };
    const batchA = await batch({
      code: 'A',
      typeId: desi,
      shedId: grower,
      hatch: day(-21),
      opened: day(-21),
      birds: 24,
      source: 'Sample: hatched under Kali, 24 chicks',
    });
    const batchB = await batch({
      code: 'B',
      typeId: kadak,
      shedId: layer,
      hatch: day(-140),
      opened: day(-140),
      birds: 30,
      source: 'Sample: bought as pullets from the weekly market',
    });
    const batchC = await batch({
      code: 'C',
      typeId: aseel,
      shedId: brooder,
      hatch: day(-400),
      opened: day(-400),
      birds: 24,
      source: 'Sample: home-bred breeders',
    });

    const sex = async (batchId: string, roosters: number, hens: number) => {
      const existing = await findId(
        db,
        'SELECT id FROM sex_counts WHERE farm_id = ? AND batch_id = ? AND counted_on = ?',
        [farmIdInner, batchId, today],
      );
      if (existing) return;
      await insertSexCount(db, {
        farmId: farmIdInner,
        batchId,
        countedOn: today,
        roosterCount: roosters,
        henCount: hens,
        createdBy: adminId,
      });
    };
    await sex(batchA, 10, 13);
    await sex(batchB, 2, 28);
    await sex(batchC, 6, 18);

    const range = await (async () => {
      const existing = await findId(db, 'SELECT id FROM range_areas WHERE farm_id = ? AND name = ?', [farmIdInner, 'Sample mango yard']);
      if (existing) return existing;
      return insertRangeArea(db, farmIdInner, 'Sample mango yard', 'Sample: daytime yard under the trees', adminId);
    })();
    const moved = await findId(
      db,
      `SELECT id FROM batch_movements WHERE farm_id = ? AND batch_id = ? AND movement_type = 'to_range'`,
      [farmIdInner, batchB],
    );
    if (!moved) {
      await insertMovement(db, {
        farmId: farmIdInner,
        batchId: batchB,
        movementType: 'to_range',
        fromShedId: layer,
        toShedId: null,
        toRangeAreaId: range,
        birdCount: 6,
        occurredOn: day(-2),
        reason: 'Sample: let six hens out for the day',
        createdBy: adminId,
      });
    }
    const death = await findId(
      db,
      `SELECT id FROM batch_movements WHERE farm_id = ? AND batch_id = ? AND movement_type = 'mortality'`,
      [farmIdInner, batchA],
    );
    let deathId = death;
    if (!deathId) {
      deathId = await insertMovement(db, {
        farmId: farmIdInner,
        batchId: batchA,
        movementType: 'mortality',
        fromShedId: grower,
        toShedId: null,
        birdCount: 1,
        occurredOn: day(-3),
        reason: 'Sample: one chick found cold in the morning',
        createdBy: adminId,
      });
    }

    const loss = async (when: string, count: number, note: string, movementId: string | null) => {
      const existing = await findId(db, 'SELECT id FROM loss_incidents WHERE farm_id = ? AND note = ?', [farmIdInner, note]);
      if (existing) return;
      await insertIncident(db, { farmId: farmIdInner, occurredOn: when, birdCount: count, note, movementId, createdBy: adminId });
    };
    await loss(day(-3), 1, 'Sample: one chick from Batch A, cold night', deathId);
    await loss(day(-10), 2, 'Sample: two growers, no movement linked', null);

    const category = async (name: string) => {
      const existing = await findId(db, 'SELECT id FROM egg_categories WHERE farm_id = ? AND name = ?', [farmIdInner, name]);
      if (existing) return existing;
      const row = await insertEggCategory(db, farmIdInner, name, adminId);
      return row.id;
    };
    const tableEggs = await category('Sample table eggs');
    const hatchEggs = await category('Sample hatching eggs');
    const cracked = await category('Sample cracked');
    for (const offset of [-6, -5, -4, -3, -2, -1, 0]) {
      const collectedOn = day(offset);
      const already = await findId(
        db,
        'SELECT id FROM egg_collections WHERE farm_id = ? AND batch_id = ? AND collected_on = ?',
        [farmIdInner, batchB, collectedOn],
      );
      if (already) continue;
      await insertCollection(db, {
        farmId: farmIdInner,
        batchId: batchB,
        shedId: layer,
        collectedOn,
        shiftLabel: offset % 2 === 0 ? 'Morning' : 'Evening',
        notes: 'Sample: counted in the layer shed',
        createdBy: adminId,
        lines: [
          { categoryId: tableEggs, eggCount: 12 + Math.abs(offset) },
          { categoryId: hatchEggs, eggCount: 4 },
          { categoryId: cracked, eggCount: offset === -1 ? 1 : 0 },
        ],
      });
    }

    const machine = async (code: string, name: string, capacity: number) => {
      const existing = await findId(db, 'SELECT id FROM incubators WHERE farm_id = ? AND code = ?', [farmIdInner, code]);
      if (existing) return existing;
      return insertIncubator(db, {
        farmId: farmIdInner,
        code,
        name,
        capacityEggs: capacity,
        notes: 'Sample machine. No target heat is stored.',
        createdBy: adminId,
      });
    };
    const box = await machine('M1', 'Sample 48-egg box', 48);
    const cabinet = await machine('M2', 'Sample cabinet', 100);
    const reading = async (incubatorId: string, when: string, time: string, temp: number, humid: number) => {
      const existing = await findId(
        db,
        'SELECT id FROM incubator_readings WHERE farm_id = ? AND incubator_id = ? AND recorded_on = ? AND recorded_time = ?',
        [farmIdInner, incubatorId, when, time],
      );
      if (existing) return;
      await insertReading(db, {
        farmId: farmIdInner,
        incubatorId,
        recordedOn: when,
        recordedTime: time,
        temperatureValue: temp,
        temperatureUnit: 'C',
        humidityValue: humid,
        humidityUnit: '%',
        powerStatus: 'on',
        source: 'manual',
        notes: 'Sample: read from the dial',
        createdBy: adminId,
      });
    };
    await reading(box, day(-1), '08:00', 37.6, 55);
    await reading(box, today, '08:10', 37.5, 58);
    await reading(cabinet, today, '18:00', 37.8, 60);
    const maintained = await findId(db, 'SELECT id FROM incubator_maintenance WHERE farm_id = ? AND incubator_id = ?', [farmIdInner, cabinet]);
    if (!maintained) {
      await insertMaintenance(db, {
        farmId: farmIdInner,
        incubatorId: cabinet,
        occurredOn: day(-4),
        status: 'out_of_service',
        notes: 'Sample: fan cleaned, left off for the afternoon',
        createdBy: adminId,
      });
      await insertMaintenance(db, {
        farmId: farmIdInner,
        incubatorId: cabinet,
        occurredOn: day(-3),
        status: 'in_service',
        notes: 'Sample: back on after the clean',
        createdBy: adminId,
      });
    }

    const sitting = async (input: {
      code: string;
      mode: 'incubator' | 'broody_hen';
      incubatorId: string | null;
      henName: string | null;
      started: string;
      eggs: number;
      notes: string;
      close?: boolean;
    }) => {
      const existing = await findId(db, 'SELECT id FROM incubation_batches WHERE farm_id = ? AND code = ?', [farmIdInner, input.code]);
      if (existing) return existing;
      const id = await insertSitting(db, {
        farmId: farmIdInner,
        code: input.code,
        mode: input.mode,
        incubatorId: input.incubatorId,
        henName: input.henName,
        startedOn: input.started,
        eggCount: input.eggs,
        notes: input.notes,
        createdBy: adminId,
      });
      if (input.close) {
        const { exec } = await import('../db/sql.js');
        await exec(db, `UPDATE incubation_batches SET status = 'closed' WHERE id = ?`, [id]);
      }
      return id;
    };
    const setMachine = await sitting({
      code: 'SET1',
      mode: 'incubator',
      incubatorId: box,
      henName: null,
      started: day(-12),
      eggs: 24,
      notes: 'Sample: eggs from Batch B in the small box',
    });
    const setHen = await sitting({
      code: 'SET2',
      mode: 'broody_hen',
      incubatorId: null,
      henName: 'Sample Kali',
      started: day(-9),
      eggs: 12,
      notes: 'Sample: Kali sitting in the brooder corner',
    });
    const hatchedMachine = await sitting({
      code: 'SET3',
      mode: 'incubator',
      incubatorId: cabinet,
      henName: null,
      started: day(-30),
      eggs: 20,
      notes: 'Sample: earlier cabinet set',
      close: true,
    });
    const hatchedHen = await sitting({
      code: 'SET4',
      mode: 'broody_hen',
      incubatorId: null,
      henName: 'Sample Chitra',
      started: day(-28),
      eggs: 10,
      notes: 'Sample: Chitra finished her clutch',
      close: true,
    });
    const candle = async (sittingId: string, when: string, lines: Array<{ label: string; eggCount: number }>) => {
      const existing = await findId(
        db,
        'SELECT id FROM candling_records WHERE farm_id = ? AND incubation_batch_id = ? AND observed_on = ?',
        [farmIdInner, sittingId, when],
      );
      if (existing) return;
      const inspected = lines.reduce((sum, line) => sum + line.eggCount, 0);
      await insertCandling(db, {
        farmId: farmIdInner,
        sittingId,
        observedOn: when,
        inspectedCount: inspected,
        notes: 'Sample: looked with a torch',
        createdBy: adminId,
        lines,
      });
    };
    await candle(setMachine, day(-2), [
      { label: 'Sample growing', eggCount: 16 },
      { label: 'Sample clear', eggCount: 4 },
    ]);
    await candle(setHen, day(-1), [
      { label: 'Sample growing', eggCount: 8 },
      { label: 'Sample clear', eggCount: 2 },
    ]);
    const hatch = async (sittingId: string, when: string, eggs: number, live: number, losses: number, other: number) => {
      const existing = await findId(db, 'SELECT id FROM hatch_records WHERE farm_id = ? AND incubation_batch_id = ?', [farmIdInner, sittingId]);
      if (existing) return;
      await insertHatch(db, {
        farmId: farmIdInner,
        sittingId,
        hatchedOn: when,
        eggsSet: eggs,
        liveChicks: live,
        losses,
        otherCount: other,
        differenceNote: 'Sample: counted by hand the morning they hatched',
        chickBatchId: batchA,
        createdBy: adminId,
      });
    };
    await hatch(hatchedMachine, day(-8), 20, 14, 4, 2);
    await hatch(hatchedHen, day(-6), 10, 7, 2, 1);

    const loadPages = async (kind: string, limit: number) => {
      const { many } = await import('../db/sql.js');
      return many<RowDataPacket & { id: string; title: string; kind: string; source_file: string; source_page: number }>(
        db,
        `SELECT id, title, kind, source_file, source_page FROM knowledge_entries WHERE kind = ? ORDER BY source_page LIMIT ${limit}`,
        [kind],
      );
    };
    const medicines = await loadPages('medicine', 2);
    const cares = await loadPages('care', 3);
    const pages = [...medicines, ...cares];
    for (const page of pages) {
      await saveApproval(db, {
        farmId: farmIdInner,
        entryId: page.id,
        approved: true,
        verificationNote: 'Sample: I read this page with the vet. Not a dose.',
        userId: adminId,
      });
    }
    const note = async (when: string, batchId: string, birds: number | null, text: string, entryId: string | null) => {
      const existing = await findId(db, 'SELECT id FROM health_observations WHERE farm_id = ? AND notes = ?', [farmIdInner, text]);
      if (existing) return;
      await insertObservation(db, {
        farmId: farmIdInner,
        observedOn: when,
        batchId,
        birdCount: birds,
        notes: text,
        entryId,
        createdBy: adminId,
      });
    };
    await note(day(-2), batchA, 3, 'Sample: three chicks in Batch A are quiet and fluffed up', pages[0]?.id ?? null);
    await note(day(-1), batchB, 1, 'Sample: one hen in Batch B is limping', pages[1]?.id ?? null);
    await note(today, batchC, null, 'Sample: breeders look bright. Bird count left blank.', null);
    for (const page of medicines) {
      const text = `Sample: gave the page "${page.title.slice(0, 80)}" to Batch B. Amount is only what the paper says.`;
      const existing = await findId(db, 'SELECT id FROM medicine_records WHERE farm_id = ? AND notes = ?', [farmIdInner, text]);
      if (existing) continue;
      await insertMedicine(db, {
        farmId: farmIdInner,
        entryId: page.id,
        givenOn: day(-1),
        batchId: batchB,
        notes: text,
        createdBy: adminId,
      });
    }
    const carePages = cares;
    const careDays = [day(-1), today, day(4)];
    const careBatches = [batchA, batchB, batchC];
    const careCodes = ['A', 'B', 'C'];
    for (let index = 0; index < carePages.length; index += 1) {
      const page = carePages[index];
      if (!page) continue;
      const title = `Sample: Batch ${careCodes[index] ?? ''} — ${page.title}`.slice(0, 160);
      const existing = await findId(db, 'SELECT id FROM tasks WHERE farm_id = ? AND title = ?', [farmIdInner, title]);
      const careBatch = careBatches[index] ?? null;
      if (existing) {
        if (careBatch) {
          await exec(
            db,
            `UPDATE audit_logs
             SET summary = JSON_SET(COALESCE(summary, JSON_OBJECT()), '$.batchId', ?)
             WHERE farm_id = ? AND entity_type = 'task' AND entity_id = ? AND action = 'health.vaccine_task_created'`,
            [careBatch, farmIdInner, existing],
          );
        }
        continue;
      }
      const taskId = await insertTask(db, {
        farmId: farmIdInner,
        templateId: null,
        title,
        instructions: 'Sample: day picked by the owner. Not read from the paper as a calendar.',
        dueOn: careDays[index] ?? today,
        assigneeUserId: workers[0]?.id ?? null,
        proofRequired: false,
        createdBy: adminId,
      });
      await writeAudit(db, {
        farmId: farmIdInner,
        actorUserId: adminId,
        action: 'health.vaccine_task_created',
        entityType: 'task',
        entityId: taskId,
        requestId: 'demo-seed',
        summary: { sourceFile: page.source_file, sourcePage: page.source_page, batchId: careBatch },
      });
    }

    const stock = async (name: string, unit: string, reorder: number | null, qty: number) => {
      const existing = await findId(db, 'SELECT id FROM stock_items WHERE farm_id = ? AND name = ?', [farmIdInner, name]);
      if (existing) return existing;
      const id = await insertStockItem(db, {
        farmId: farmIdInner,
        name,
        unitLabel: unit,
        reorderLevel: reorder,
        notes: 'Sample feed bag. The low line is only when the amount is under the number you set.',
        createdBy: adminId,
      });
      await insertStockMovement(db, {
        farmId: farmIdInner,
        itemId: id,
        movementType: 'receipt',
        direction: 'in',
        quantity: qty,
        occurredOn: day(-5),
        batchId: batchB,
        shedId: layer,
        lotCode: 'SAMPLE-LOT',
        expiresOn: day(60),
        unitCost: 42,
        supplierName: 'Sample grain shop',
        reason: 'Sample: bought at the shop',
        createdBy: adminId,
      });
      return id;
    };
    await stock('Sample layer mash', 'kg', 25, 12);
    await stock('Sample broken rice', 'kg', 10, 40);
    await stock('Sample shell grit', 'kg', null, 8);
    const watered = await findId(db, 'SELECT id FROM water_records WHERE farm_id = ? AND notes = ?', [farmIdInner, 'Sample: morning drinkers']);
    if (!watered) {
      await insertWater(db, {
        farmId: farmIdInner,
        recordedOn: today,
        batchId: batchB,
        shedId: layer,
        quantity: 20,
        unitLabel: 'L',
        sourceNote: 'Sample: borewell',
        testNote: null,
        notes: 'Sample: morning drinkers',
        createdBy: adminId,
      });
      await insertWater(db, {
        farmId: farmIdInner,
        recordedOn: day(-1),
        batchId: batchA,
        shedId: grower,
        quantity: 8,
        unitLabel: 'L',
        sourceNote: 'Sample: stored pot',
        testNote: 'Sample: looked clear, not a lab test',
        notes: 'Sample: chick water',
        createdBy: adminId,
      });
    }
    const targeted = await findId(db, 'SELECT id FROM growth_targets WHERE farm_id = ? AND bird_type_id = ? AND age_days = ?', [farmIdInner, desi, 21]);
    if (!targeted) {
      await insertTarget(db, { farmId: farmIdInner, birdTypeId: desi, ageDays: 21, targetWeight: 180, weightUnit: 'g', createdBy: adminId });
      await insertTarget(db, { farmId: farmIdInner, birdTypeId: kadak, ageDays: 140, targetWeight: 1.1, weightUnit: 'kg', createdBy: adminId });
    }
    const weighed = await findId(db, 'SELECT id FROM growth_weighings WHERE farm_id = ? AND batch_id = ? AND weighed_on = ?', [farmIdInner, batchA, today]);
    if (!weighed) {
      await insertWeighing(db, {
        farmId: farmIdInner,
        batchId: batchA,
        weighedOn: today,
        ageDays: 21,
        weightValue: 170,
        weightUnit: 'g',
        birdCount: 4,
        notes: 'Sample: four birds from Batch A',
        createdBy: adminId,
      });
      await insertWeighing(db, {
        farmId: farmIdInner,
        batchId: batchB,
        weighedOn: day(-1),
        ageDays: 139,
        weightValue: 1.05,
        weightUnit: 'kg',
        birdCount: 2,
        notes: 'Sample: two hens from Batch B',
        createdBy: adminId,
      });
    }

    const template = async (name: string, season: 'summer_heat' | 'monsoon' | null, step: string) => {
      const existing = await findId(db, 'SELECT id FROM task_templates WHERE farm_id = ? AND name = ?', [farmIdInner, name]);
      if (existing) return existing;
      const id = await insertTemplate(db, farmIdInner, name, season, adminId);
      await insertStep(db, id, step);
      return id;
    };
    const summer = await template('Sample summer checks', 'summer_heat', 'Sample: look at the drinkers twice');
    await template('Sample monsoon checks', 'monsoon', 'Sample: look at the roof after rain');
    const job = async (title: string, due: string, who: string | null, done: boolean) => {
      const existing = await findId(db, 'SELECT id FROM tasks WHERE farm_id = ? AND title = ?', [farmIdInner, title]);
      if (existing) return;
      const id = await insertTask(db, {
        farmId: farmIdInner,
        templateId: summer,
        title,
        instructions: 'Sample job. Nothing was filled in from the age of the flock.',
        dueOn: due,
        assigneeUserId: who,
        proofRequired: false,
        createdBy: adminId,
      });
      if (done) await completeTask(db, farmIdInner, id, 'Sample: done this morning', adminId);
    };
    await job('Sample: mend the fence', day(-1), workers[1]?.id ?? null, false);
    await job('Sample: collect eggs from Batch B', today, workers[0]?.id ?? null, false);
    await job('Sample: filled the drinkers', day(-2), workers[0]?.id ?? null, true);

    const customer = async (name: string, phone: string) => {
      const existing = await findId(db, 'SELECT id FROM customers WHERE farm_id = ? AND name = ?', [farmIdInner, name]);
      if (existing) return existing;
      return insertCustomer(db, farmIdInner, name, phone, 'Sample buyer', adminId);
    };
    const shop = await customer('Sample village shop', '9811100091');
    const neighbour = await customer('Sample neighbour Anita', '9811100092');
    const priced = await findId(db, 'SELECT id FROM market_prices WHERE farm_id = ? AND item_name = ?', [farmIdInner, 'Sample table egg']);
    if (!priced) {
      await insertPrice(db, { farmId: farmIdInner, itemName: 'Sample table egg', amount: 8, unitLabel: 'INR each', effectiveOn: day(-7), createdBy: adminId });
      await insertPrice(db, { farmId: farmIdInner, itemName: 'Sample live hen', amount: 350, unitLabel: 'INR each', effectiveOn: day(-7), createdBy: adminId });
    }
    const sold = await findId(db, 'SELECT id FROM orders WHERE farm_id = ? AND customer_id = ? AND ordered_on = ?', [farmIdInner, shop, day(-1)]);
    if (!sold) {
      await insertSaleOrder(db, {
        farmId: farmIdInner,
        customerId: shop,
        orderedOn: day(-1),
        createdBy: adminId,
        lines: [{ description: 'Sample table eggs', quantity: 30, unitPrice: 8 }],
      });
      await insertSaleOrder(db, {
        farmId: farmIdInner,
        customerId: neighbour,
        orderedOn: today,
        createdBy: adminId,
        lines: [{ description: 'Sample live hen', quantity: 1, unitPrice: 350 }],
      });
    }

    const expenseCat = async (name: string) => {
      const existing = await findId(db, 'SELECT id FROM expense_categories WHERE farm_id = ? AND name = ?', [farmIdInner, name]);
      if (existing) return existing;
      return insertCategory(db, farmIdInner, name, adminId);
    };
    const feedCost = await expenseCat('Sample feed');
    const wages = await expenseCat('Sample wages');
    const spent = await findId(db, 'SELECT id FROM expense_entries WHERE farm_id = ? AND notes = ?', [farmIdInner, 'Sample: mash from the grain shop']);
    if (!spent) {
      await insertEntry(db, {
        farmId: farmIdInner,
        occurredOn: day(-5),
        direction: 'expense',
        categoryId: feedCost,
        amount: 840,
        unitLabel: 'INR',
        counterparty: 'Sample grain shop',
        referenceNote: 'Sample slip 12',
        notes: 'Sample: mash from the grain shop',
        batchId: batchB,
        reversesEntryId: null,
        createdBy: adminId,
      });
      await insertEntry(db, {
        farmId: farmIdInner,
        occurredOn: day(-1),
        direction: 'expense',
        categoryId: wages,
        amount: 300,
        unitLabel: 'INR',
        counterparty: 'Sample Lata',
        referenceNote: 'Sample week',
        notes: 'Sample: help in the layer shed',
        batchId: null,
        reversesEntryId: null,
        createdBy: adminId,
      });
      await insertEntry(db, {
        farmId: farmIdInner,
        occurredOn: today,
        direction: 'income',
        categoryId: feedCost,
        amount: 240,
        unitLabel: 'INR',
        counterparty: 'Sample village shop',
        referenceNote: 'Sample eggs',
        notes: 'Sample: egg money written by hand',
        batchId: batchB,
        reversesEntryId: null,
        createdBy: adminId,
      });
    }

    const lata = workers[0]?.id;
    const raju = workers[1]?.id;
    if (lata && raju) {
      const came = await findId(db, 'SELECT id FROM attendance_records WHERE farm_id = ? AND user_id = ? AND attended_on = ?', [farmIdInner, lata, today]);
      if (!came) {
        await insertAttendance(db, {
          farmId: farmIdInner,
          userId: lata,
          attendedOn: today,
          attendedTime: '07:30',
          methodLabel: 'Sample: seen at the gate',
          note: 'Sample: Lata opened the layer shed',
          createdBy: adminId,
        });
        await insertAttendance(db, {
          farmId: farmIdInner,
          userId: raju,
          attendedOn: day(-1),
          attendedTime: '08:00',
          methodLabel: 'Sample: seen at the gate',
          note: 'Sample: Raju filled drinkers',
          createdBy: adminId,
        });
        await insertAttendance(db, {
          farmId: farmIdInner,
          userId: lata,
          attendedOn: day(-1),
          attendedTime: null,
          methodLabel: 'Sample: marked later',
          note: 'Sample: time not written',
          createdBy: adminId,
        });
      }
      const lesson = await findId(db, 'SELECT id FROM training_items WHERE farm_id = ? AND title = ? AND version_label = ?', [
        farmIdInner,
        'Sample: shut the shed at dusk',
        '1',
      ]);
      if (!lesson) {
        const first = await insertTraining(db, {
          farmId: farmIdInner,
          title: 'Sample: shut the shed at dusk',
          body: 'Sample: walk the yard and close the pop-hole.',
          versionLabel: '1',
          createdBy: adminId,
        });
        const second = await insertTraining(db, {
          farmId: farmIdInner,
          title: 'Sample: count eggs the same way',
          body: 'Sample: table, hatching, and cracked stay separate.',
          versionLabel: '1',
          createdBy: adminId,
        });
        const assigned = await insertAssignment(db, { farmId: farmIdInner, itemId: first, userId: lata, dueOn: today, createdBy: adminId });
        await insertAssignment(db, { farmId: farmIdInner, itemId: second, userId: raju, dueOn: day(2), createdBy: adminId });
        await insertCompletion(db, { farmId: farmIdInner, assignmentId: assigned, note: 'Sample: Lata closed the shed', completedBy: adminId });
      }
    }

    const supplier = async (name: string, phone: string) => {
      const existing = await findId(db, 'SELECT id FROM suppliers WHERE farm_id = ? AND name = ?', [farmIdInner, name]);
      if (existing) return existing;
      return insertSupplier(db, {
        id: '',
        name,
        contactName: name,
        phone,
        notes: 'Sample shop. Money owed is not worked out.',
        farmId: farmIdInner,
        createdBy: adminId,
      });
    };
    const grain = await supplier('Sample grain shop', '9811100081');
    const mill = await supplier('Sample oil mill', '9811100082');
    const bought = await findId(db, 'SELECT id FROM purchase_orders WHERE farm_id = ? AND supplier_id = ?', [farmIdInner, grain]);
    if (!bought) {
      const order = await insertPurchaseOrder(db, {
        farmId: farmIdInner,
        supplierId: grain,
        orderedOn: day(-6),
        notes: 'Sample: mash order',
        createdBy: adminId,
        lines: [{ description: 'Sample layer mash', quantity: 20, unitLabel: 'kg', unitPrice: 42, priceUnit: 'INR' }],
      });
      await insertPurchaseOrder(db, {
        farmId: farmIdInner,
        supplierId: mill,
        orderedOn: day(-3),
        notes: 'Sample: rice bran',
        createdBy: adminId,
        lines: [{ description: 'Sample rice bran', quantity: 10, unitLabel: 'kg', unitPrice: null, priceUnit: '' }],
      });
      await insertReceipt(db, {
        farmId: farmIdInner,
        supplierId: grain,
        purchaseOrderId: order,
        receivedOn: day(-5),
        acceptedQuantity: 18,
        rejectedQuantity: 2,
        unitLabel: 'kg',
        note: 'Sample: two kilos were wet',
        createdBy: adminId,
      });
      await insertReceipt(db, {
        farmId: farmIdInner,
        supplierId: mill,
        purchaseOrderId: null,
        receivedOn: day(-2),
        acceptedQuantity: 10,
        rejectedQuantity: 0,
        unitLabel: 'kg',
        note: 'Sample: bran looked dry',
        createdBy: adminId,
      });
      await insertBill(db, {
        farmId: farmIdInner,
        supplierId: grain,
        billedOn: day(-5),
        amount: 840,
        unitLabel: 'INR',
        referenceNote: 'Sample slip 12',
        notes: 'Sample bill. Not subtracted from a payment.',
        createdBy: adminId,
      });
      await insertBill(db, {
        farmId: farmIdInner,
        supplierId: mill,
        billedOn: day(-2),
        amount: 200,
        unitLabel: 'INR',
        referenceNote: 'Sample slip 4',
        notes: 'Sample bran bill',
        createdBy: adminId,
      });
      await insertPayment(db, {
        farmId: farmIdInner,
        supplierId: grain,
        paidOn: day(-4),
        amount: 500,
        unitLabel: 'INR',
        referenceNote: 'Sample cash',
        notes: 'Sample part payment. Not a balance.',
        createdBy: adminId,
      });
      await insertPayment(db, {
        farmId: farmIdInner,
        supplierId: mill,
        paidOn: day(-1),
        amount: 200,
        unitLabel: 'INR',
        referenceNote: 'Sample cash',
        notes: 'Sample paid in full by hand',
        createdBy: adminId,
      });
    }

    const billed = await findId(db, 'SELECT id FROM invoice_documents WHERE farm_id = ? AND customer_id = ? AND issued_on = ?', [farmIdInner, shop, day(-1)]);
    if (!billed) {
      const doc = await insertDocument(db, {
        farmId: farmIdInner,
        customerId: shop,
        orderId: null,
        issuedOn: day(-1),
        notes: 'Sample bill note. Not posted to the books.',
        createdBy: adminId,
        lines: [{ description: 'Sample table eggs', quantity: 30, unitLabel: 'eggs', unitPrice: 8, priceUnit: 'INR' }],
      });
      await insertDocument(db, {
        farmId: farmIdInner,
        customerId: neighbour,
        orderId: null,
        issuedOn: today,
        notes: 'Sample hen note. Not posted.',
        createdBy: adminId,
        lines: [{ description: 'Sample live hen', quantity: 1, unitLabel: 'bird', unitPrice: 350, priceUnit: 'INR' }],
      });
      await insertReturn(db, {
        farmId: farmIdInner,
        documentId: doc,
        returnedOn: today,
        description: 'Sample cracked eggs returned',
        quantity: 2,
        amount: 16,
        unitLabel: 'INR',
        note: 'Sample: shop sent two back',
        createdBy: adminId,
      });
    }
    const extraReturn = await findId(db, 'SELECT id FROM sale_returns WHERE farm_id = ? AND note = ?', [farmIdInner, 'Sample: one hen note written back']);
    if (!extraReturn) {
      const otherDoc = await findId(
        db,
        'SELECT id FROM invoice_documents WHERE farm_id = ? AND customer_id = ? ORDER BY issued_on DESC',
        [farmIdInner, neighbour],
      );
      if (otherDoc) {
        await insertReturn(db, {
          farmId: farmIdInner,
          documentId: otherDoc,
          returnedOn: today,
          description: 'Sample live hen note',
          quantity: 0,
          amount: null,
          unitLabel: null,
          note: 'Sample: one hen note written back',
          createdBy: adminId,
        });
      }
    }

    const yard = async (kind: 'note' | 'let_out' | 'shut_in', when: string, time: string, body: string) => {
      const existing = await findId(db, 'SELECT id FROM yard_notes WHERE farm_id = ? AND body = ?', [farmIdInner, body]);
      if (existing) return;
      await insertNote(db, { farmId: farmIdInner, notedOn: when, kind, notedTime: time, body, createdBy: adminId });
    };
    await yard('let_out', today, '07:45', 'Sample: Batch B out under the mango trees');
    await yard('shut_in', day(-1), '18:30', 'Sample: all birds shut in before dark');
    await yard('note', day(-1), '', 'Sample: dog barked near the fence');

    const parents = await findId(db, 'SELECT id FROM parentage_records WHERE farm_id = ? AND note = ?', [farmIdInner, 'Sample: Batch A chicks from the breeders']);
    if (!parents) {
      await insertParentage(db, {
        farmId: farmIdInner,
        recordedOn: day(-21),
        offspringBatchId: batchA,
        sireNote: 'Sample red rooster',
        damNote: 'Sample spotted hen',
        sireBatchId: batchC,
        damBatchId: batchC,
        note: 'Sample: Batch A chicks from the breeders',
        createdBy: adminId,
      });
      await insertParentage(db, {
        farmId: farmIdInner,
        recordedOn: day(-20),
        offspringBatchId: null,
        sireNote: 'Sample second rooster',
        damNote: '',
        sireBatchId: null,
        damBatchId: batchC,
        note: 'Sample: dam is Batch C, sire written by hand',
        createdBy: adminId,
      });
    }

    if (lata) {
      const told = await findId(db, 'SELECT id FROM notifications WHERE farm_id = ? AND title = ?', [farmIdInner, 'Sample: shut the shed']);
      if (!told) {
        await insertNotice(db, {
          farmId: farmIdInner,
          userId: lata,
          title: 'Sample: shut the shed',
          body: 'Sample: please shut Batch B before dark.',
          createdBy: adminId,
        });
        await insertNotice(db, {
          farmId: farmIdInner,
          userId: adminId,
          title: 'Sample: mash is low',
          body: 'Sample: the layer mash is under the number you set.',
          createdBy: adminId,
        });
      }
    }

    const named = await findId(db, 'SELECT id FROM report_schedules WHERE farm_id = ? AND name = ?', [farmIdInner, 'Sample weekly eggs']);
    if (!named) {
      await insertSchedule(db, {
        farmId: farmIdInner,
        name: 'Sample weekly eggs',
        note: 'Sample name only. Nothing is sent.',
        namedOn: today,
        createdBy: adminId,
      });
      await insertSchedule(db, {
        farmId: farmIdInner,
        name: 'Sample month money',
        note: 'Sample name only. No profit is worked out.',
        namedOn: day(-7),
        createdBy: adminId,
      });
    }

    const step = await findId(db, 'SELECT id FROM biosecurity_steps WHERE farm_id = ? AND body = ?', [farmIdInner, 'Sample: wash hands before the layer shed']);
    if (!step) {
      await insertBiosecurity(db, {
        farmId: farmIdInner,
        body: 'Sample: wash hands before the layer shed',
        origin: 'owner',
        sourceFile: null,
        sourcePage: null,
        approved: true,
        createdBy: adminId,
      });
      await insertBiosecurity(db, {
        farmId: farmIdInner,
        body: 'Sample: keep visitor shoes outside',
        origin: 'owner',
        sourceFile: null,
        sourcePage: null,
        approved: true,
        createdBy: adminId,
      });
    }

    const uploads = path.resolve(fileURLToPath(new URL('../../../uploads', import.meta.url)));
    await mkdir(uploads, { recursive: true });
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      'base64',
    );
    const files = [
      { stored: 'sample-feed-slip.png', name: 'Sample feed slip.png', note: 'Sample photo of a shop slip' },
      { stored: 'sample-shed-note.png', name: 'Sample shed note.png', note: 'Sample photo of the layer shed' },
    ];
    for (const file of files) {
      const existing = await findId(db, 'SELECT id FROM farm_files WHERE farm_id = ? AND stored_name = ?', [farmIdInner, file.stored]);
      if (existing) continue;
      await writeFile(path.join(uploads, file.stored), png);
      await insertFile(db, {
        farmId: farmIdInner,
        originalName: file.name,
        storedName: file.stored,
        mediaType: 'image/png',
        byteSize: png.byteLength,
        note: file.note,
        createdBy: adminId,
      });
    }

    return farmIdInner;
  });

  return [
    'Demo farm is ready. Every row is marked Sample.',
    `Farm code ${DEMO_FARM_CODE} (${farmId}).`,
    `Owner ${DEMO_ADMIN_EMAIL} / ${DEMO_ADMIN_PASSWORD}`,
    'That short password is only for this demo account. Sign-up still asks for 10 characters.',
    `Manager ${DEMO_MANAGER_EMAIL} / ${DEMO_MANAGER_PASSWORD}`,
    ...DEMO_WORKERS.map((worker) => `Worker ${worker.name}: mobile ${worker.mobile}, PIN ${worker.pin}`),
  ].join('\n');
}
