import { randomUUID } from 'node:crypto';
import type { RowDataPacket } from 'mysql2/promise';
import { exec, many, one, type Db } from '../../db/sql.js';

export const VERIFY_LABEL = 'owner/vet must verify before use';
export const STEP_FILE = 'patil-poultry-step-by-step-process.pdf';

export type KnowledgeEntry = {
  id: string;
  sourceFile: string;
  sourcePage: number;
  title: string;
  kind: 'disease' | 'medicine' | 'care';
  textLayer: string;
  usedFor: string;
  symptoms: string;
  howToGive: string;
  scheduleText: string;
  precautions: string;
  mustVerify: true;
  verifyLabel: typeof VERIFY_LABEL;
  approved: boolean;
  verificationNote: string | null;
};

export type HealthObservation = {
  id: string;
  observedOn: string;
  batchId: string | null;
  birdCount: number | null;
  notes: string;
  entryId: string | null;
  entryTitle: string | null;
};

export type MedicineRecord = {
  id: string;
  entryId: string;
  entryTitle: string;
  givenOn: string;
  batchId: string | null;
  notes: string;
};

export type BiosecurityStep = {
  id: string;
  body: string;
  origin: 'owner' | 'pdf';
  sourceFile: string | null;
  sourcePage: number | null;
  approved: boolean;
  mustVerify: boolean;
};

function asDate(value: Date | string): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

export async function listEntries(db: Db, farmId: string): Promise<KnowledgeEntry[]> {
  const rows = await many<
    RowDataPacket & {
      id: string;
      source_file: string;
      source_page: number;
      title: string;
      kind: 'disease' | 'medicine' | 'care';
      text_layer: string;
      used_for: string | null;
      symptoms: string | null;
      how_to_give: string | null;
      schedule_text: string | null;
      precautions: string | null;
      approved: number | null;
      verification_note: string | null;
    }
  >(
    db,
    `SELECT e.id, e.source_file, e.source_page, e.title, e.kind, e.text_layer, e.used_for, e.symptoms, e.how_to_give, e.schedule_text, e.precautions, a.approved, a.verification_note
     FROM knowledge_entries e
     LEFT JOIN knowledge_approvals a ON a.entry_id = e.id AND a.farm_id = ?
     ORDER BY FIELD(e.kind, 'disease', 'medicine', 'care'), e.source_file, e.source_page, e.title`,
    [farmId],
  );
  return rows.map((row) => ({
    id: row.id,
    sourceFile: row.source_file,
    sourcePage: Number(row.source_page),
    title: row.title,
    kind: row.kind,
    textLayer: row.text_layer,
    usedFor: row.used_for ?? '',
    symptoms: row.symptoms ?? '',
    howToGive: row.how_to_give ?? '',
    scheduleText: row.schedule_text ?? '',
    precautions: row.precautions ?? '',
    mustVerify: true,
    verifyLabel: VERIFY_LABEL,
    approved: Number(row.approved) === 1,
    verificationNote: row.verification_note,
  }));
}

export async function findEntry(db: Db, farmId: string, entryId: string): Promise<KnowledgeEntry | null> {
  const rows = await listEntries(db, farmId);
  return rows.find((row) => row.id === entryId) ?? null;
}

export async function findEntryByPage(db: Db, sourceFile: string, sourcePage: number): Promise<{ id: string; textLayer: string } | null> {
  const row = await one<RowDataPacket & { id: string; text_layer: string }>(
    db,
    `SELECT id, text_layer FROM knowledge_entries WHERE source_file = ? AND source_page = ?`,
    [sourceFile, sourcePage],
  );
  return row ? { id: row.id, textLayer: row.text_layer } : null;
}

export async function saveApproval(
  db: Db,
  input: { farmId: string; entryId: string; approved: boolean; verificationNote: string | null; userId: string },
): Promise<void> {
  await exec(
    db,
    `INSERT INTO knowledge_approvals (id, farm_id, entry_id, approved, verification_note, updated_by)
     VALUES (?, ?, ?, ?, ?, ?) AS new_row
     ON DUPLICATE KEY UPDATE approved = new_row.approved, verification_note = new_row.verification_note, updated_by = new_row.updated_by`,
    [randomUUID(), input.farmId, input.entryId, input.approved ? 1 : 0, input.verificationNote, input.userId],
  );
}

export async function insertObservation(
  db: Db,
  input: {
    farmId: string;
    observedOn: string;
    batchId: string | null;
    birdCount: number | null;
    notes: string;
    entryId: string | null;
    createdBy: string;
  },
): Promise<string> {
  const id = randomUUID();
  await exec(
    db,
    `INSERT INTO health_observations (id, farm_id, observed_on, batch_id, bird_count, notes, entry_id, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, input.farmId, input.observedOn, input.batchId, input.birdCount, input.notes, input.entryId, input.createdBy],
  );
  return id;
}

export async function listObservations(db: Db, farmId: string): Promise<HealthObservation[]> {
  const rows = await many<
    RowDataPacket & {
      id: string;
      observed_on: Date | string;
      batch_id: string | null;
      bird_count: number | null;
      notes: string;
      entry_id: string | null;
      entry_title: string | null;
    }
  >(
    db,
    `SELECT o.id, o.observed_on, o.batch_id, o.bird_count, o.notes, o.entry_id, e.title AS entry_title
     FROM health_observations o
     LEFT JOIN knowledge_entries e ON e.id = o.entry_id
     WHERE o.farm_id = ?
     ORDER BY o.observed_on DESC, o.created_at DESC
     LIMIT 50`,
    [farmId],
  );
  return rows.map((row) => ({
    id: row.id,
    observedOn: asDate(row.observed_on),
    batchId: row.batch_id,
    birdCount: row.bird_count === null ? null : Number(row.bird_count),
    notes: row.notes,
    entryId: row.entry_id,
    entryTitle: row.entry_title,
  }));
}

export async function insertMedicine(
  db: Db,
  input: { farmId: string; entryId: string; givenOn: string; batchId: string | null; notes: string; createdBy: string },
): Promise<string> {
  const id = randomUUID();
  await exec(
    db,
    `INSERT INTO medicine_records (id, farm_id, entry_id, given_on, batch_id, notes, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, input.farmId, input.entryId, input.givenOn, input.batchId, input.notes, input.createdBy],
  );
  return id;
}

export async function listMedicines(db: Db, farmId: string): Promise<MedicineRecord[]> {
  const rows = await many<
    RowDataPacket & {
      id: string;
      entry_id: string;
      title: string;
      given_on: Date | string;
      batch_id: string | null;
      notes: string;
    }
  >(
    db,
    `SELECT m.id, m.entry_id, e.title, m.given_on, m.batch_id, m.notes
     FROM medicine_records m
     JOIN knowledge_entries e ON e.id = m.entry_id
     WHERE m.farm_id = ?
     ORDER BY m.given_on DESC, m.created_at DESC
     LIMIT 50`,
    [farmId],
  );
  return rows.map((row) => ({
    id: row.id,
    entryId: row.entry_id,
    entryTitle: row.title,
    givenOn: asDate(row.given_on),
    batchId: row.batch_id,
    notes: row.notes,
  }));
}

export async function insertBiosecurity(
  db: Db,
  input: {
    farmId: string;
    body: string;
    origin: 'owner' | 'pdf';
    sourceFile: string | null;
    sourcePage: number | null;
    approved: boolean;
    createdBy: string;
  },
): Promise<string> {
  const id = randomUUID();
  await exec(
    db,
    `INSERT INTO biosecurity_steps (id, farm_id, body, origin, source_file, source_page, approved, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, input.farmId, input.body, input.origin, input.sourceFile, input.sourcePage, input.approved ? 1 : 0, input.createdBy],
  );
  return id;
}

export async function listBiosecurity(db: Db, farmId: string): Promise<BiosecurityStep[]> {
  const rows = await many<
    RowDataPacket & {
      id: string;
      body: string;
      origin: 'owner' | 'pdf';
      source_file: string | null;
      source_page: number | null;
      approved: number;
    }
  >(db, `SELECT id, body, origin, source_file, source_page, approved FROM biosecurity_steps WHERE farm_id = ? ORDER BY created_at`, [
    farmId,
  ]);
  return rows.map((row) => ({
    id: row.id,
    body: row.body,
    origin: row.origin,
    sourceFile: row.source_file,
    sourcePage: row.source_page === null ? null : Number(row.source_page),
    approved: Number(row.approved) === 1,
    mustVerify: row.origin === 'pdf',
  }));
}

export async function approveBiosecurity(db: Db, farmId: string, stepId: string): Promise<boolean> {
  const result = await exec(
    db,
    `UPDATE biosecurity_steps SET approved = 1 WHERE farm_id = ? AND id = ? AND origin = 'pdf'`,
    [farmId, stepId],
  );
  return result.affectedRows === 1;
}
