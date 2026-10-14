import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { RowDataPacket } from 'mysql2/promise';
import { exec, many, one } from '../../db/sql.js';
import { pool } from '../../db/pool.js';
import { withTransaction } from '../../db/transaction.js';
import { AppError } from '../../http/errors.js';
import { writeAudit } from '../audit/repository.js';
import { todayInTimeZone } from '../batches/service.js';
import { findFarmById } from '../farms/repository.js';
import type { FarmAccess } from '../farms/access.js';
import { ownerGroupsToday, ownerLinesForBatch, markOwnerDose, readOwnerPhoto } from '../medicines/service.js';
import {
  DOSE_SOURCE,
  DOSE_TEMPLATE_ID,
  paperDay,
  shiftDate,
  type DoseSlot,
} from './catalog.js';

const uploads = path.resolve(fileURLToPath(new URL('../../../../uploads/medicine-photos', import.meta.url)));
const defaults = path.resolve(fileURLToPath(new URL('../../../../client/public/medicines', import.meta.url)));
const knockout = path.resolve(fileURLToPath(new URL('../../../scripts/knockout_white.py', import.meta.url)));

type Actor = { user: { id: string }; requestId: string };

type Row = {
  id: string;
  dayFrom: number | null;
  dayTo: number | null;
  dayLabel: string;
  slot: DoseSlot;
  itemName: string;
  amountText: string;
  unclear: boolean;
  sourcePage: number;
  amountPage: number | null;
  medicineKeys: string[];
  sort: number;
};

export type DoseLine = {
  rowId: string;
  day: number | null;
  date: string | null;
  dayLabel: string;
  slot: DoseSlot;
  itemName: string;
  amountText: string;
  unclear: boolean;
  sourceFile: string;
  sourcePage: number;
  amountPage: number | null;
  medicineKeys: string[];
  given: boolean;
  origin: 'paper' | 'owner';
};

const slotOrder: Record<DoseSlot, number> = { morning: 0, evening: 1, full_day: 2 };

function asDay(value: Date | string | null): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

async function loadRows(): Promise<Row[]> {
  const rows = await many<
    RowDataPacket & {
      id: string;
      day_from: number | null;
      day_to: number | null;
      day_label: string;
      slot: DoseSlot;
      item_name: string;
      amount_text: string;
      unclear: number;
      source_page: number;
      amount_page: number | null;
      medicine_keys: string;
      sort_order: number;
    }
  >(
    pool,
    `SELECT id, day_from, day_to, day_label, slot, item_name, amount_text, unclear, source_page, amount_page, medicine_keys, sort_order
     FROM schedule_rows WHERE template_id = ? ORDER BY sort_order`,
    [DOSE_TEMPLATE_ID],
  );
  return rows.map((row) => ({
    id: row.id,
    dayFrom: row.day_from === null ? null : Number(row.day_from),
    dayTo: row.day_to === null ? null : Number(row.day_to),
    dayLabel: row.day_label,
    slot: row.slot,
    itemName: row.item_name,
    amountText: row.amount_text,
    unclear: Number(row.unclear) === 1,
    sourcePage: Number(row.source_page),
    amountPage: row.amount_page === null ? null : Number(row.amount_page),
    medicineKeys: row.medicine_keys.split(',').filter(Boolean),
    sort: Number(row.sort_order),
  }));
}

function covers(row: Row, day: number): boolean {
  return row.dayFrom !== null && row.dayFrom <= day && day <= (row.dayTo ?? row.dayFrom);
}

function line(row: Row, day: number | null, date: string | null, given: Set<string>): DoseLine {
  const key = day === null ? '' : `${row.id}|${date}`;
  return {
    rowId: row.id,
    day,
    date,
    dayLabel: row.dayLabel,
    slot: row.slot,
    itemName: row.itemName,
    amountText: row.amountText,
    unclear: row.unclear,
    sourceFile: DOSE_SOURCE,
    sourcePage: row.sourcePage,
    amountPage: row.amountPage,
    medicineKeys: row.medicineKeys,
    given: given.has(key),
    origin: 'paper',
  };
}

async function approval(farmId: string): Promise<boolean> {
  const row = await one<RowDataPacket & { approved: number }>(
    pool,
    'SELECT approved FROM farm_schedule_approvals WHERE farm_id = ? AND template_id = ?',
    [farmId, DOSE_TEMPLATE_ID],
  );
  return Number(row?.approved ?? 0) === 1;
}

async function farmToday(farmId: string): Promise<{ today: string; zone: string }> {
  const farm = await findFarmById(pool, farmId, false);
  if (!farm) throw new AppError(404, 'NOT_FOUND', 'Not found.');
  return { today: todayInTimeZone(farm.timezone), zone: farm.timezone };
}

export async function getBatchDoses(farmId: string, batchId: string) {
  const batch = await one<RowDataPacket & { id: string; code: string; hatch_date: Date | string | null }>(
    pool,
    'SELECT id, code, hatch_date FROM batches WHERE farm_id = ? AND id = ?',
    [farmId, batchId],
  );
  if (!batch) throw new AppError(404, 'NOT_FOUND', 'Not found.');
  const { today } = await farmToday(farmId);
  const hatch = asDay(batch.hatch_date);
  const day = paperDay(hatch, today);
  const rows = await loadRows();
  const marks = await many<RowDataPacket & { schedule_row_id: string; given_on: Date | string }>(
    pool,
    'SELECT schedule_row_id, given_on FROM batch_dose_marks WHERE farm_id = ? AND batch_id = ?',
    [farmId, batchId],
  );
  const given = new Set(marks.map((mark) => `${mark.schedule_row_id}|${asDay(mark.given_on)}`));
  const dated = new Set<number>();
  for (const row of rows) {
    if (row.dayFrom === null) continue;
    for (let n = row.dayFrom; n <= (row.dayTo ?? row.dayFrom); n += 1) dated.add(n);
  }
  if (day !== null) dated.add(day);
  const extra = await ownerLinesForBatch(farmId, batchId);
  for (const line of extra) {
    if (line.day !== null) dated.add(line.day);
  }
  const days = [...dated]
    .sort((a, b) => a - b)
    .map((n) => {
      const date = hatch ? shiftDate(hatch, n - 1) : null;
      const lines = rows
        .filter((row) => covers(row, n))
        .sort((a, b) => slotOrder[a.slot] - slotOrder[b.slot] || a.sort - b.sort)
        .map((row) => line(row, n, date, given));
      lines.push(...extra.filter((line) => line.day === n));
      return { day: n, date, today: n === day, lines };
    });
  const on = (n: number | null) => (n === null ? [] : (days.find((item) => item.day === n)?.lines ?? []));
  const floating = extra.filter((line) => line.day === null);
  const tomorrow = shiftDate(today, 1);
  const weekEnd = shiftDate(today, 6);
  return {
    approved: await approval(farmId),
    batchCode: batch.code,
    hatchDate: hatch,
    ageDays: day === null ? null : day - 1,
    paperDay: day,
    today,
    sourceFile: DOSE_SOURCE,
    todayLines: [...on(day), ...floating.filter((line) => line.date === today)],
    tomorrowLines: [...on(day === null ? null : day + 1), ...floating.filter((line) => line.date === tomorrow)],
    weekLines: [
      ...(day === null ? [] : days.filter((item) => item.day >= day && item.day <= day + 6).flatMap((item) => item.lines)),
      ...floating.filter((line) => line.date !== null && line.date >= today && line.date <= weekEnd),
    ],
    undated: rows.filter((row) => row.dayFrom === null).map((row) => line(row, null, null, new Set())),
    days,
  };
}

export async function medicineToday(farmId: string) {
  const checked = await approval(farmId);
  const { today } = await farmToday(farmId);
  const owned = await ownerGroupsToday(farmId, today);
  if (!checked) return { approved: false as const, groups: owned };
  const batches = await many<RowDataPacket & { id: string; code: string; hatch_date: Date | string | null; status: string }>(
    pool,
    `SELECT id, code, hatch_date, status FROM batches WHERE farm_id = ? AND status = 'open' ORDER BY code`,
    [farmId],
  );
  const rows = await loadRows();
  const marks = await many<RowDataPacket & { batch_id: string; schedule_row_id: string }>(
    pool,
    'SELECT batch_id, schedule_row_id FROM batch_dose_marks WHERE farm_id = ? AND given_on = ?',
    [farmId, today],
  );
  const given = new Set(marks.map((mark) => `${mark.batch_id}|${mark.schedule_row_id}`));
  const groups: DoseGroup[] = [];
  for (const batch of batches) {
    const hatch = asDay(batch.hatch_date);
    const day = paperDay(hatch, today);
    if (day === null) continue;
    const lines = rows
      .filter((row) => covers(row, day))
      .sort((a, b) => slotOrder[a.slot] - slotOrder[b.slot] || a.sort - b.sort)
      .map((row) => ({ ...line(row, day, today, new Set(given.has(`${batch.id}|${row.id}`) ? [`${row.id}|${today}`] : [])), given: given.has(`${batch.id}|${row.id}`) }));
    for (const extra of owned.find((group) => group.batchId === batch.id)?.lines ?? []) lines.push(extra);
    if (lines.length === 0) continue;
    groups.push({ batchId: batch.id, batchCode: batch.code, paperDay: day, lines });
  }
  for (const group of owned) {
    if (!groups.some((item) => item.batchId === group.batchId)) groups.push(group);
  }
  return { approved: true as const, groups };
}

export type DoseGroup = {
  batchId: string;
  batchCode: string;
  paperDay: number | null;
  lines: DoseLine[];
};

export async function approveSchedule(actor: Actor, access: FarmAccess, body: unknown) {
  const note = typeof body === 'object' && body && 'verificationNote' in body ? String((body as { verificationNote: unknown }).verificationNote ?? '') : '';
  const trimmed = note.trim();
  if (trimmed.length < 1 || trimmed.length > 500) {
    throw new AppError(422, 'VALIDATION_ERROR', 'Write a short note that you checked this paper.', { fields: { verificationNote: 'too_small' } });
  }
  await withTransaction(async (conn) => {
    await exec(
      conn,
      `INSERT INTO farm_schedule_approvals (farm_id, template_id, approved, verification_note, approved_by)
       VALUES (?, ?, 1, ?, ?)
       ON DUPLICATE KEY UPDATE approved = 1, verification_note = VALUES(verification_note), approved_by = VALUES(approved_by), approved_at = CURRENT_TIMESTAMP(3)`,
      [access.farmId, DOSE_TEMPLATE_ID, trimmed, actor.user.id],
    );
    await writeAudit(conn, {
      farmId: access.farmId,
      actorUserId: actor.user.id,
      action: 'dose.schedule_approved',
      entityType: 'schedule_template',
      entityId: DOSE_TEMPLATE_ID,
      requestId: actor.requestId,
      summary: { sourceFile: DOSE_SOURCE },
    });
  });
  return { approved: true, templateId: DOSE_TEMPLATE_ID };
}

export async function markDose(actor: Actor, access: FarmAccess, batchId: string, body: unknown) {
  const rowId = typeof body === 'object' && body && 'rowId' in body ? String((body as { rowId: unknown }).rowId ?? '') : '';
  const givenOn = typeof body === 'object' && body && 'givenOn' in body ? String((body as { givenOn: unknown }).givenOn ?? '') : '';
  if (!/^[0-9a-f-]{36}$/i.test(rowId) || !/^\d{4}-\d{2}-\d{2}$/.test(givenOn)) {
    throw new AppError(422, 'VALIDATION_ERROR', 'Choose a line and a day.', { fields: { rowId: 'invalid_format' } });
  }
  const owned = await markOwnerDose(actor, access, batchId, rowId, givenOn);
  if (owned) return owned;
  if (!(await approval(access.farmId))) {
    throw new AppError(409, 'ENTRY_UNAPPROVED', 'That paper is not checked yet.');
  }
  const { today } = await farmToday(access.farmId);
  if (givenOn > today) {
    throw new AppError(422, 'VALIDATION_ERROR', 'That date is in the future.', { fields: { givenOn: 'future_date' } });
  }
  const batch = await one<RowDataPacket & { hatch_date: Date | string | null }>(
    pool,
    'SELECT hatch_date FROM batches WHERE farm_id = ? AND id = ?',
    [access.farmId, batchId],
  );
  if (!batch) throw new AppError(404, 'NOT_FOUND', 'Not found.');
  const hatch = asDay(batch.hatch_date);
  const day = paperDay(hatch, givenOn);
  const rows = await loadRows();
  const row = rows.find((item) => item.id === rowId);
  if (!row) throw new AppError(404, 'NOT_FOUND', 'Not found.');
  if (row.dayFrom === null || day === null || !covers(row, day)) {
    throw new AppError(422, 'VALIDATION_ERROR', 'That line is not on this day.', { fields: { rowId: 'invalid_format' } });
  }
  const id = randomUUID();
  await withTransaction(async (conn) => {
    await exec(
      conn,
      `INSERT INTO batch_dose_marks (id, farm_id, batch_id, schedule_row_id, given_on, created_by)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE id = id`,
      [id, access.farmId, batchId, rowId, givenOn, actor.user.id],
    );
    await writeAudit(conn, {
      farmId: access.farmId,
      actorUserId: actor.user.id,
      action: 'dose.marked_given',
      entityType: 'batch_dose_mark',
      entityId: id,
      requestId: actor.requestId,
      summary: { batchId, rowId, givenOn, sourceFile: DOSE_SOURCE, sourcePage: row.sourcePage },
    });
  });
  return { given: true, rowId, givenOn };
}

const allowed = new Set(['image/jpeg', 'image/png', 'image/webp']);

export async function storeMedicinePhoto(
  actor: Actor,
  access: FarmAccess,
  medicineKey: string,
  file: { buffer: Buffer; mimetype: string; size: number } | undefined,
) {
  if (!/^[a-z0-9-]{2,40}$/.test(medicineKey)) throw new AppError(404, 'NOT_FOUND', 'Not found.');
  const known = (await loadRows()).some((row) => row.medicineKeys.includes(medicineKey));
  if (!known) throw new AppError(404, 'NOT_FOUND', 'Not found.');
  if (!file || !allowed.has(file.mimetype)) {
    throw new AppError(422, 'VALIDATION_ERROR', 'Choose a photo.', { fields: { file: 'invalid_format' } });
  }
  const dir = path.join(uploads, access.farmId);
  await mkdir(dir, { recursive: true });
  const stored = `${medicineKey}.png`;
  const dest = path.join(dir, stored);
  const raw = path.join(dir, `${medicineKey}.upload`);
  await writeFile(raw, file.buffer);
  const removed = await runKnockout(raw, dest);
  if (!removed) await writeFile(dest, file.buffer);
  const id = randomUUID();
  await exec(
    pool,
    `INSERT INTO medicine_photos (id, farm_id, medicine_key, stored_name, media_type, background_removed, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE stored_name = VALUES(stored_name), media_type = VALUES(media_type), background_removed = VALUES(background_removed), created_by = VALUES(created_by), created_at = CURRENT_TIMESTAMP(3)`,
    [id, access.farmId, medicineKey, stored, removed ? 'image/png' : file.mimetype, removed ? 1 : 0, actor.user.id],
  );
  return { medicineKey, backgroundRemoved: removed };
}

function runKnockout(source: string, dest: string): Promise<boolean> {
  return new Promise((resolve) => {
    const child = spawn('python3', [knockout, source, dest], { stdio: 'ignore' });
    child.on('error', () => resolve(false));
    child.on('close', (code) => resolve(code === 0));
  });
}

export async function openMedicinePhoto(farmId: string, medicineKey: string): Promise<{ bytes: Buffer; mediaType: string }> {
  if (!/^[a-z0-9-]{2,40}$/.test(medicineKey)) throw new AppError(404, 'NOT_FOUND', 'Not found.');
  const row = await one<RowDataPacket & { stored_name: string; media_type: string }>(
    pool,
    'SELECT stored_name, media_type FROM medicine_photos WHERE farm_id = ? AND medicine_key = ?',
    [farmId, medicineKey],
  );
  if (row) {
    const bytes = await readFile(path.join(uploads, farmId, row.stored_name));
    return { bytes, mediaType: row.media_type };
  }
  const owned = await readOwnerPhoto(farmId, medicineKey);
  if (owned) return owned;
  try {
    const bytes = await readFile(path.join(defaults, `${medicineKey}.png`));
    return { bytes, mediaType: 'image/png' };
  } catch {
    throw new AppError(404, 'NOT_FOUND', 'Not found.');
  }
}
