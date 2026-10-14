import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  OWNER_CITE,
  ownerCourse,
  ownerDiseaseInputSchema,
  ownerDoseSentence,
  ownerMedicineInputSchema,
  ownerPhotoKey,
  ownerPlanInputSchema,
  ownerScheduleText,
  type DoseSlot,
  type MedicineRoute,
  type MedicineSource,
} from '@gavran/shared';
import type { KbEntry } from '@gavran/shared';
import type { RowDataPacket } from 'mysql2';
import { exec, many, one } from '../../db/sql.js';
import { pool } from '../../db/pool.js';
import { withTransaction } from '../../db/transaction.js';
import { AppError } from '../../http/errors.js';
import { writeAudit } from '../audit/repository.js';
import { todayInTimeZone } from '../batches/service.js';
import { findFarmById } from '../farms/repository.js';
import type { FarmAccess } from '../farms/access.js';

const uploads = path.resolve(fileURLToPath(new URL('../../../../uploads/owner-medicines', import.meta.url)));
const diseaseUploads = path.resolve(fileURLToPath(new URL('../../../../uploads/owner-diseases', import.meta.url)));
const knockout = path.resolve(fileURLToPath(new URL('../../../scripts/knockout_white.py', import.meta.url)));
const allowed = new Set(['image/jpeg', 'image/png', 'image/webp']);

type Actor = { user: { id: string }; requestId: string };

export type OwnerDoseLine = {
  rowId: string;
  day: number | null;
  date: string | null;
  dayLabel: string;
  slot: DoseSlot;
  itemName: string;
  amountText: string;
  unclear: false;
  sourceFile: typeof OWNER_CITE;
  sourcePage: 0;
  amountPage: null;
  medicineKeys: string[];
  given: boolean;
  origin: 'owner';
};

type PlanRow = {
  id: string;
  batch_id: string;
  anchor: 'date' | 'age';
  start_on: Date | string | null;
  start_age_day: number | null;
  repeat_days: number;
  name: string;
  dose_amount: string;
  dose_unit: string;
  for_birds: number | null;
  route: MedicineRoute;
  slot: DoseSlot;
  age_day_from: number | null;
  age_day_to: number | null;
  duration_days: number;
  notes: string;
  precaution: string;
  photo_key: string | null;
  photo_name: string | null;
  hatch_date: Date | string | null;
  batch_code: string;
};

function asDay(value: Date | string | null): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

async function farmToday(farmId: string): Promise<string> {
  const farm = await findFarmById(pool, farmId, false);
  if (!farm) throw new AppError(404, 'NOT_FOUND', 'Not found.');
  return todayInTimeZone(farm.timezone);
}

function sentence(row: Pick<PlanRow, 'dose_amount' | 'dose_unit' | 'route' | 'for_birds' | 'notes' | 'precaution'>): string {
  return ownerDoseSentence({
    doseAmount: row.dose_amount,
    doseUnit: row.dose_unit,
    route: row.route,
    forBirds: row.for_birds === null ? null : Number(row.for_birds),
    notes: row.notes,
    precaution: row.precaution,
  });
}

function toLine(row: PlanRow, date: string, paper: number | null, given: boolean): OwnerDoseLine {
  return {
    rowId: row.id,
    day: paper,
    date,
    dayLabel: row.name,
    slot: row.slot,
    itemName: row.name,
    amountText: sentence(row),
    unclear: false,
    sourceFile: OWNER_CITE,
    sourcePage: 0,
    amountPage: null,
    medicineKeys: row.photo_name && row.photo_key ? [row.photo_key] : [],
    given,
    origin: 'owner',
  };
}

const planSql = `SELECT p.id, p.batch_id, p.anchor, p.start_on, p.start_age_day, p.repeat_days,
    m.name, m.dose_amount, m.dose_unit, m.for_birds, m.route, m.slot, m.age_day_from, m.age_day_to,
    m.duration_days, m.notes, m.precaution, m.photo_key, m.photo_name, b.hatch_date, b.code AS batch_code
  FROM owner_batch_plans p
  JOIN owner_medicines m ON m.id = p.medicine_id AND m.status = 'active'
  JOIN batches b ON b.id = p.batch_id
  WHERE p.farm_id = ? AND p.status = 'active' AND b.status = 'open'`;

async function plans(farmId: string, batchId?: string): Promise<PlanRow[]> {
  const sql = batchId ? `${planSql} AND p.batch_id = ?` : planSql;
  return many<RowDataPacket & PlanRow>(pool, sql, batchId ? [farmId, batchId] : [farmId]);
}

function pointsOf(row: PlanRow) {
  return ownerCourse({
    anchor: row.anchor,
    startOn: asDay(row.start_on),
    startAgeDay: row.start_age_day === null ? null : Number(row.start_age_day),
    durationDays: Number(row.duration_days),
    repeatDays: Number(row.repeat_days),
    hatchDate: asDay(row.hatch_date),
  });
}

export async function ownerLinesForBatch(farmId: string, batchId: string): Promise<OwnerDoseLine[]> {
  const rows = await plans(farmId, batchId);
  if (rows.length === 0) return [];
  const marks = await many<RowDataPacket & { plan_id: string; given_on: Date | string }>(
    pool,
    'SELECT plan_id, given_on FROM owner_dose_marks WHERE farm_id = ? AND batch_id = ?',
    [farmId, batchId],
  );
  const given = new Set(marks.map((mark) => `${mark.plan_id}|${asDay(mark.given_on)}`));
  const lines: OwnerDoseLine[] = [];
  for (const row of rows) {
    for (const point of pointsOf(row)) {
      lines.push(toLine(row, point.date, point.paperDay, given.has(`${row.id}|${point.date}`)));
    }
  }
  return lines;
}

export async function ownerGroupsToday(farmId: string, today: string): Promise<Array<{ batchId: string; batchCode: string; paperDay: number | null; lines: OwnerDoseLine[] }>> {
  const rows = await plans(farmId);
  const marks = await many<RowDataPacket & { plan_id: string }>(
    pool,
    'SELECT plan_id FROM owner_dose_marks WHERE farm_id = ? AND given_on = ?',
    [farmId, today],
  );
  const given = new Set(marks.map((mark) => mark.plan_id));
  const groups = new Map<string, { batchId: string; batchCode: string; paperDay: number | null; lines: OwnerDoseLine[] }>();
  for (const row of rows) {
    const point = pointsOf(row).find((item) => item.date === today);
    if (!point) continue;
    const group = groups.get(row.batch_id) ?? { batchId: row.batch_id, batchCode: row.batch_code, paperDay: point.paperDay, lines: [] };
    group.lines.push(toLine(row, point.date, point.paperDay, given.has(row.id)));
    groups.set(row.batch_id, group);
  }
  return [...groups.values()];
}

export async function markOwnerDose(actor: Actor, access: FarmAccess, batchId: string, rowId: string, givenOn: string): Promise<{ given: true; rowId: string; givenOn: string } | null> {
  const row = (await plans(access.farmId, batchId)).find((item) => item.id === rowId);
  if (!row) return null;
  const { today } = { today: await farmToday(access.farmId) };
  if (givenOn > today) throw new AppError(422, 'VALIDATION_ERROR', 'That date is in the future.', { fields: { givenOn: 'future_date' } });
  if (!pointsOf(row).some((point) => point.date === givenOn)) {
    throw new AppError(422, 'VALIDATION_ERROR', 'That line is not on this day.', { fields: { rowId: 'invalid_format' } });
  }
  const id = randomUUID();
  await withTransaction(async (conn) => {
    await exec(
      conn,
      `INSERT INTO owner_dose_marks (id, farm_id, batch_id, plan_id, given_on, created_by)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE id = id`,
      [id, access.farmId, batchId, rowId, givenOn, actor.user.id],
    );
    await writeAudit(conn, {
      farmId: access.farmId,
      actorUserId: actor.user.id,
      action: 'dose.marked_given',
      entityType: 'owner_dose_mark',
      entityId: id,
      requestId: actor.requestId,
      summary: { batchId, rowId, givenOn, sourceFile: OWNER_CITE },
    });
  });
  return { given: true, rowId, givenOn };
}

async function linked(medicineId: string) {
  const rows = await many<
    RowDataPacket & { knowledge_entry_id: string | null; owner_disease_id: string | null; title: string | null; symptoms: string | null; disease_name: string | null; disease_symptoms: string | null }
  >(
    pool,
    `SELECT l.knowledge_entry_id, l.owner_disease_id, e.title, e.symptoms, d.name AS disease_name, d.symptoms AS disease_symptoms
     FROM owner_medicine_links l
     LEFT JOIN knowledge_entries e ON e.id = l.knowledge_entry_id
     LEFT JOIN owner_diseases d ON d.id = l.owner_disease_id
     WHERE l.medicine_id = ?`,
    [medicineId],
  );
  return rows.map((row) => ({
    knowledgeEntryId: row.knowledge_entry_id,
    ownerDiseaseId: row.owner_disease_id,
    name: row.title ?? row.disease_name ?? '',
    symptoms: row.symptoms ?? row.disease_symptoms ?? '',
  }));
}

async function assertLinks(farmId: string, knowledgeEntryIds: string[], ownerDiseaseIds: string[]) {
  if (knowledgeEntryIds.length > 0) {
    const found = await many<RowDataPacket & { id: string }>(
      pool,
      `SELECT id FROM knowledge_entries WHERE kind = 'disease' AND id IN (${knowledgeEntryIds.map(() => '?').join(',')})`,
      knowledgeEntryIds,
    );
    if (found.length !== knowledgeEntryIds.length) throw new AppError(422, 'VALIDATION_ERROR', 'Choose a disease from the papers.', { fields: { knowledgeEntryIds: 'invalid_format' } });
  }
  if (ownerDiseaseIds.length > 0) {
    const found = await many<RowDataPacket & { id: string }>(
      pool,
      `SELECT id FROM owner_diseases WHERE farm_id = ? AND status = 'active' AND id IN (${ownerDiseaseIds.map(() => '?').join(',')})`,
      [farmId, ...ownerDiseaseIds],
    );
    if (found.length !== ownerDiseaseIds.length) throw new AppError(422, 'VALIDATION_ERROR', 'Choose a disease you added.', { fields: { ownerDiseaseIds: 'invalid_format' } });
  }
}

async function replaceLinks(medicineId: string, knowledgeEntryIds: string[], ownerDiseaseIds: string[], farmId: string) {
  await assertLinks(farmId, knowledgeEntryIds, ownerDiseaseIds);
  await pool.query('DELETE FROM owner_medicine_links WHERE medicine_id = ?', [medicineId]);
  for (const entryId of knowledgeEntryIds) {
    await pool.query('INSERT INTO owner_medicine_links (id, medicine_id, knowledge_entry_id, owner_disease_id) VALUES (?, ?, ?, NULL)', [randomUUID(), medicineId, entryId]);
  }
  for (const diseaseId of ownerDiseaseIds) {
    await pool.query('INSERT INTO owner_medicine_links (id, medicine_id, knowledge_entry_id, owner_disease_id) VALUES (?, ?, NULL, ?)', [randomUUID(), medicineId, diseaseId]);
  }
}

function present(row: RowDataPacket, diseases: Awaited<ReturnType<typeof linked>>) {
  return {
    id: row.id as string,
    name: row.name as string,
    doseAmount: row.dose_amount as string,
    doseUnit: row.dose_unit as string,
    forBirds: row.for_birds === null ? null : Number(row.for_birds),
    route: row.route as MedicineRoute,
    slot: row.slot as DoseSlot,
    ageDayFrom: row.age_day_from === null ? null : Number(row.age_day_from),
    ageDayTo: row.age_day_to === null ? null : Number(row.age_day_to),
    durationDays: Number(row.duration_days),
    notes: row.notes as string,
    precaution: row.precaution as string,
    sourceKind: row.source_kind as MedicineSource,
    sourceDetail: row.source_detail as string,
    photoKey: row.photo_name && row.photo_key ? String(row.photo_key) : null,
    cite: OWNER_CITE,
    diseases,
  };
}

export async function listMedicines(farmId: string) {
  const rows = await many<RowDataPacket>(pool, 'SELECT * FROM owner_medicines WHERE farm_id = ? AND status = ? ORDER BY name', [farmId, 'active']);
  const plans = await many<RowDataPacket>(
    pool,
    `SELECT p.id, p.medicine_id, p.batch_id, p.anchor, p.start_on, p.start_age_day, p.repeat_days, b.code AS batch_code
     FROM owner_batch_plans p JOIN batches b ON b.id = p.batch_id
     WHERE p.farm_id = ? AND p.status = 'active'`,
    [farmId],
  );
  const items = [];
  for (const row of rows) {
    items.push({
      ...present(row, await linked(String(row.id))),
      plans: plans
        .filter((plan) => plan.medicine_id === row.id)
        .map((plan) => ({
          id: plan.id as string,
          batchId: plan.batch_id as string,
          batchCode: plan.batch_code as string,
          anchor: plan.anchor as string,
          startOn: asDay(plan.start_on as Date | string | null),
          startAgeDay: plan.start_age_day === null ? null : Number(plan.start_age_day),
          repeatDays: Number(plan.repeat_days),
        })),
    });
  }
  return items;
}

export async function medicineChoices(farmId: string) {
  const diseases = await many<RowDataPacket & { id: string; title: string; symptoms: string }>(
    pool,
    `SELECT id, title, COALESCE(symptoms, '') AS symptoms FROM knowledge_entries WHERE kind = 'disease' ORDER BY title`,
  );
  const own = await many<RowDataPacket & { id: string; name: string; symptoms: string }>(
    pool,
    `SELECT id, name, symptoms FROM owner_diseases WHERE farm_id = ? AND status = 'active' ORDER BY name`,
    [farmId],
  );
  const batches = await many<RowDataPacket & { id: string; code: string; hatch_date: Date | string | null }>(
    pool,
    `SELECT id, code, hatch_date FROM batches WHERE farm_id = ? AND status = 'open' ORDER BY code`,
    [farmId],
  );
  return {
    paperDiseases: diseases.map((row) => ({ id: row.id, name: row.title, symptoms: row.symptoms })),
    ownerDiseases: own.map((row) => ({ id: row.id, name: row.name, symptoms: row.symptoms })),
    batches: batches.map((row) => ({ id: row.id, code: row.code, hatchDate: asDay(row.hatch_date) })),
  };
}

export async function createDisease(actor: Actor, access: FarmAccess, body: unknown) {
  const input = ownerDiseaseInputSchema.parse(body);
  const id = randomUUID();
  await withTransaction(async (conn) => {
    await exec(conn, 'INSERT INTO owner_diseases (id, farm_id, name, symptoms, created_by) VALUES (?, ?, ?, ?, ?)', [id, access.farmId, input.name, input.symptoms, actor.user.id]);
    await writeAudit(conn, {
      farmId: access.farmId,
      actorUserId: actor.user.id,
      action: 'owner_disease.created',
      entityType: 'owner_disease',
      entityId: id,
      requestId: actor.requestId,
      summary: { name: input.name },
    });
  });
  return { id, name: input.name, symptoms: input.symptoms, cite: OWNER_CITE };
}

export async function createMedicine(actor: Actor, access: FarmAccess, body: unknown) {
  const input = ownerMedicineInputSchema.parse(body);
  await assertLinks(access.farmId, input.knowledgeEntryIds, input.ownerDiseaseIds);
  const id = randomUUID();
  await withTransaction(async (conn) => {
    await exec(
      conn,
      `INSERT INTO owner_medicines
        (id, farm_id, name, dose_amount, dose_unit, for_birds, route, slot, age_day_from, age_day_to, duration_days, notes, precaution, source_kind, source_detail, photo_key, created_by, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        access.farmId,
        input.name,
        input.doseAmount,
        input.doseUnit,
        input.forBirds,
        input.route,
        input.slot,
        input.ageDayFrom,
        input.ageDayTo,
        input.durationDays,
        input.notes,
        input.precaution,
        input.sourceKind,
        input.sourceDetail,
        ownerPhotoKey(id),
        actor.user.id,
        actor.user.id,
      ],
    );
    await writeAudit(conn, {
      farmId: access.farmId,
      actorUserId: actor.user.id,
      action: 'owner_medicine.created',
      entityType: 'owner_medicine',
      entityId: id,
      requestId: actor.requestId,
      summary: { name: input.name, sourceKind: input.sourceKind, cite: OWNER_CITE },
    });
  });
  await replaceLinks(id, input.knowledgeEntryIds, input.ownerDiseaseIds, access.farmId);
  const row = await one<RowDataPacket>(pool, 'SELECT * FROM owner_medicines WHERE id = ?', [id]);
  if (!row) throw new AppError(404, 'NOT_FOUND', 'Not found.');
  return present(row, await linked(id));
}

export async function updateMedicine(actor: Actor, access: FarmAccess, medicineId: string, body: unknown) {
  const input = ownerMedicineInputSchema.parse(body);
  const existing = await one<RowDataPacket>(pool, `SELECT id FROM owner_medicines WHERE farm_id = ? AND id = ? AND status = 'active'`, [access.farmId, medicineId]);
  if (!existing) throw new AppError(404, 'NOT_FOUND', 'Not found.');
  await withTransaction(async (conn) => {
    await exec(
      conn,
      `UPDATE owner_medicines SET name = ?, dose_amount = ?, dose_unit = ?, for_birds = ?, route = ?, slot = ?, age_day_from = ?, age_day_to = ?, duration_days = ?, notes = ?, precaution = ?, source_kind = ?, source_detail = ?, updated_by = ? WHERE id = ?`,
      [input.name, input.doseAmount, input.doseUnit, input.forBirds, input.route, input.slot, input.ageDayFrom, input.ageDayTo, input.durationDays, input.notes, input.precaution, input.sourceKind, input.sourceDetail, actor.user.id, medicineId],
    );
    await writeAudit(conn, {
      farmId: access.farmId,
      actorUserId: actor.user.id,
      action: 'owner_medicine.updated',
      entityType: 'owner_medicine',
      entityId: medicineId,
      requestId: actor.requestId,
      summary: { name: input.name },
    });
  });
  await replaceLinks(medicineId, input.knowledgeEntryIds, input.ownerDiseaseIds, access.farmId);
  const row = await one<RowDataPacket>(pool, 'SELECT * FROM owner_medicines WHERE id = ?', [medicineId]);
  if (!row) throw new AppError(404, 'NOT_FOUND', 'Not found.');
  return present(row, await linked(medicineId));
}

export async function archiveMedicine(actor: Actor, access: FarmAccess, medicineId: string) {
  const existing = await one<RowDataPacket>(pool, `SELECT id, name FROM owner_medicines WHERE farm_id = ? AND id = ? AND status = 'active'`, [access.farmId, medicineId]);
  if (!existing) throw new AppError(404, 'NOT_FOUND', 'Not found.');
  await withTransaction(async (conn) => {
    await exec(conn, `UPDATE owner_medicines SET status = 'archived', updated_by = ? WHERE id = ?`, [actor.user.id, medicineId]);
    await exec(conn, `UPDATE owner_batch_plans SET status = 'archived' WHERE medicine_id = ?`, [medicineId]);
    await writeAudit(conn, {
      farmId: access.farmId,
      actorUserId: actor.user.id,
      action: 'owner_medicine.deleted',
      entityType: 'owner_medicine',
      entityId: medicineId,
      requestId: actor.requestId,
      summary: { name: existing.name },
    });
  });
  return { archived: true, id: medicineId };
}

export async function attachPlan(actor: Actor, access: FarmAccess, medicineId: string, body: unknown) {
  const input = ownerPlanInputSchema.parse(body);
  const medicine = await one<RowDataPacket>(pool, `SELECT id FROM owner_medicines WHERE farm_id = ? AND id = ? AND status = 'active'`, [access.farmId, medicineId]);
  if (!medicine) throw new AppError(404, 'NOT_FOUND', 'Not found.');
  const batch = await one<RowDataPacket & { hatch_date: Date | string | null }>(pool, `SELECT hatch_date FROM batches WHERE farm_id = ? AND id = ? AND status = 'open'`, [access.farmId, input.batchId]);
  if (!batch) throw new AppError(422, 'VALIDATION_ERROR', 'Choose an open flock.', { fields: { batchId: 'invalid_format' } });
  if (input.anchor === 'age' && !asDay(batch.hatch_date)) {
    throw new AppError(422, 'VALIDATION_ERROR', 'This flock has no hatch date. Start from a date.', { fields: { startAgeDay: 'required' } });
  }
  const id = randomUUID();
  await withTransaction(async (conn) => {
    await exec(
      conn,
      `INSERT INTO owner_batch_plans (id, farm_id, batch_id, medicine_id, anchor, start_on, start_age_day, repeat_days, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, access.farmId, input.batchId, medicineId, input.anchor, input.anchor === 'date' ? input.startOn : null, input.anchor === 'age' ? input.startAgeDay : null, input.repeatDays, actor.user.id],
    );
    await writeAudit(conn, {
      farmId: access.farmId,
      actorUserId: actor.user.id,
      action: 'owner_medicine.attached',
      entityType: 'owner_batch_plan',
      entityId: id,
      requestId: actor.requestId,
      summary: { medicineId, batchId: input.batchId, anchor: input.anchor },
    });
  });
  return { id, medicineId, batchId: input.batchId };
}

function runKnockout(source: string, dest: string): Promise<boolean> {
  return new Promise((resolve) => {
    const child = spawn('python3', [knockout, source, dest], { stdio: 'ignore' });
    child.on('error', () => resolve(false));
    child.on('close', (code) => resolve(code === 0));
  });
}

async function savePhoto(dir: string, name: string, file: { buffer: Buffer; mimetype: string } | undefined) {
  if (!file || !allowed.has(file.mimetype)) throw new AppError(422, 'VALIDATION_ERROR', 'Choose a photo.', { fields: { file: 'invalid_format' } });
  await mkdir(dir, { recursive: true });
  const dest = path.join(dir, name);
  const raw = path.join(dir, `${name}.upload`);
  await writeFile(raw, file.buffer);
  const removed = await runKnockout(raw, dest);
  if (!removed) await writeFile(dest, file.buffer);
  return { removed, mediaType: removed ? 'image/png' : file.mimetype };
}

export async function storeOwnerPhoto(actor: Actor, access: FarmAccess, medicineId: string, file: { buffer: Buffer; mimetype: string } | undefined) {
  const row = await one<RowDataPacket & { photo_key: string }>(pool, `SELECT photo_key FROM owner_medicines WHERE farm_id = ? AND id = ? AND status = 'active'`, [access.farmId, medicineId]);
  if (!row) throw new AppError(404, 'NOT_FOUND', 'Not found.');
  const saved = await savePhoto(path.join(uploads, access.farmId), `${medicineId}.png`, file);
  await pool.query('UPDATE owner_medicines SET photo_name = ?, photo_type = ?, background_removed = ? WHERE id = ?', [`${medicineId}.png`, saved.mediaType, saved.removed ? 1 : 0, medicineId]);
  await writeAudit(pool, {
    farmId: access.farmId,
    actorUserId: actor.user.id,
    action: 'owner_medicine.updated',
    entityType: 'owner_medicine',
    entityId: medicineId,
    requestId: actor.requestId,
    summary: { photo: true, backgroundRemoved: saved.removed },
  });
  return { photoKey: row.photo_key, backgroundRemoved: saved.removed };
}

export async function readOwnerPhoto(farmId: string, photoKey: string): Promise<{ bytes: Buffer; mediaType: string } | null> {
  const row = await one<RowDataPacket & { photo_name: string | null; photo_type: string | null }>(
    pool,
    'SELECT photo_name, photo_type FROM owner_medicines WHERE farm_id = ? AND photo_key = ? AND photo_name IS NOT NULL',
    [farmId, photoKey],
  );
  if (!row?.photo_name) return null;
  const bytes = await readFile(path.join(uploads, farmId, row.photo_name));
  return { bytes, mediaType: row.photo_type ?? 'image/png' };
}

export async function storeDiseasePhoto(actor: Actor, access: FarmAccess, diseaseId: string, file: { buffer: Buffer; mimetype: string } | undefined) {
  const disease = await one<RowDataPacket>(pool, `SELECT id FROM owner_diseases WHERE farm_id = ? AND id = ? AND status = 'active'`, [access.farmId, diseaseId]);
  if (!disease) throw new AppError(404, 'NOT_FOUND', 'Not found.');
  const id = randomUUID();
  const saved = await savePhoto(path.join(diseaseUploads, access.farmId), `${id}.png`, file);
  await pool.query(
    'INSERT INTO owner_disease_photos (id, farm_id, disease_id, stored_name, media_type, background_removed, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [id, access.farmId, diseaseId, `${id}.png`, saved.mediaType, saved.removed ? 1 : 0, actor.user.id],
  );
  return { id, backgroundRemoved: saved.removed };
}

export async function loadCareEntries(farmId: string): Promise<KbEntry[]> {
  const rows = await many<RowDataPacket>(pool, `SELECT * FROM owner_medicines WHERE farm_id = ? AND status = 'active'`, [farmId]);
  const entries: KbEntry[] = [];
  for (const row of rows) {
    const diseases = await linked(String(row.id));
    const symptoms = diseases.map((item) => item.symptoms).filter(Boolean).join(' ');
    const usedFor = diseases.map((item) => item.name).filter(Boolean).join('. ');
    entries.push({
      id: String(row.id),
      title: String(row.name),
      sourceFile: OWNER_CITE,
      sourcePage: 0,
      symptoms,
      usedFor,
      howToGive: sentence(row as PlanRow),
      scheduleText: ownerScheduleText({
        slot: row.slot as DoseSlot,
        durationDays: Number(row.duration_days),
        ageDayFrom: row.age_day_from === null ? null : Number(row.age_day_from),
        ageDayTo: row.age_day_to === null ? null : Number(row.age_day_to),
      }),
    });
  }
  return entries;
}
