import { randomUUID } from 'node:crypto';
import type { RowDataPacket } from 'mysql2/promise';
import { exec, many, one, type Db } from '../../db/sql.js';

export type ParentageRecord = {
  id: string;
  recordedOn: string;
  offspringBatchId: string | null;
  offspringCode: string | null;
  sireNote: string;
  damNote: string;
  sireBatchId: string | null;
  sireCode: string | null;
  damBatchId: string | null;
  damCode: string | null;
  note: string;
};

function asDate(value: Date | string): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

export async function batchOnFarm(db: Db, farmId: string, batchId: string): Promise<boolean> {
  const row = await one<RowDataPacket>(db, `SELECT id FROM batches WHERE farm_id = ? AND id = ?`, [farmId, batchId]);
  return Boolean(row);
}

export async function listParentage(db: Db, farmId: string): Promise<ParentageRecord[]> {
  const rows = await many<
    RowDataPacket & {
      id: string;
      recorded_on: Date | string;
      offspring_batch_id: string | null;
      offspring_code: string | null;
      sire_note: string;
      dam_note: string;
      sire_batch_id: string | null;
      sire_code: string | null;
      dam_batch_id: string | null;
      dam_code: string | null;
      note: string;
    }
  >(
    db,
    `SELECT p.id, p.recorded_on, p.offspring_batch_id, o.code AS offspring_code,
            p.sire_note, p.dam_note, p.sire_batch_id, s.code AS sire_code, p.dam_batch_id, d.code AS dam_code, p.note
     FROM parentage_records p
     LEFT JOIN batches o ON o.id = p.offspring_batch_id
     LEFT JOIN batches s ON s.id = p.sire_batch_id
     LEFT JOIN batches d ON d.id = p.dam_batch_id
     WHERE p.farm_id = ?
     ORDER BY p.recorded_on DESC, p.created_at DESC`,
    [farmId],
  );
  return rows.map((row) => ({
    id: row.id,
    recordedOn: asDate(row.recorded_on),
    offspringBatchId: row.offspring_batch_id,
    offspringCode: row.offspring_code,
    sireNote: row.sire_note,
    damNote: row.dam_note,
    sireBatchId: row.sire_batch_id,
    sireCode: row.sire_code,
    damBatchId: row.dam_batch_id,
    damCode: row.dam_code,
    note: row.note,
  }));
}

export async function insertParentage(
  db: Db,
  input: {
    farmId: string;
    recordedOn: string;
    offspringBatchId: string | null;
    sireNote: string;
    damNote: string;
    sireBatchId: string | null;
    damBatchId: string | null;
    note: string;
    createdBy: string;
  },
): Promise<string> {
  const id = randomUUID();
  await exec(
    db,
    `INSERT INTO parentage_records
      (id, farm_id, recorded_on, offspring_batch_id, sire_note, dam_note, sire_batch_id, dam_batch_id, note, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.farmId,
      input.recordedOn,
      input.offspringBatchId,
      input.sireNote,
      input.damNote,
      input.sireBatchId,
      input.damBatchId,
      input.note,
      input.createdBy,
    ],
  );
  return id;
}
