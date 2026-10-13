import { randomUUID } from 'node:crypto';
import type { RowDataPacket } from 'mysql2/promise';
import { asNumber, exec, many, one, type Db } from '../../db/sql.js';

export type HatchRecord = {
  id: string;
  hatchedOn: string;
  eggsSet: number;
  liveChicks: number;
  losses: number;
  otherCount: number;
  differenceNote: string | null;
  chickBatchId: string | null;
  chickBatchCode: string | null;
};

function asDate(value: Date | string): string {
  return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
}

export async function eggsAlreadySet(db: Db, sittingId: string): Promise<number> {
  const row = await one<RowDataPacket & { total: number | string | null }>(
    db,
    `SELECT COALESCE(SUM(eggs_set), 0) AS total FROM hatch_records WHERE incubation_batch_id = ?`,
    [sittingId],
  );
  return row && row.total !== null ? asNumber(row.total) : 0;
}

export async function insertHatch(
  db: Db,
  input: {
    farmId: string;
    sittingId: string;
    hatchedOn: string;
    eggsSet: number;
    liveChicks: number;
    losses: number;
    otherCount: number;
    differenceNote: string | null;
    chickBatchId: string | null;
    createdBy: string;
  },
): Promise<string> {
  const id = randomUUID();
  await exec(
    db,
    `INSERT INTO hatch_records
      (id, farm_id, incubation_batch_id, hatched_on, eggs_set, live_chicks, losses, other_count, difference_note, chick_batch_id, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.farmId,
      input.sittingId,
      input.hatchedOn,
      input.eggsSet,
      input.liveChicks,
      input.losses,
      input.otherCount,
      input.differenceNote,
      input.chickBatchId,
      input.createdBy,
    ],
  );
  return id;
}

export async function listHatches(db: Db, farmId: string, sittingId: string): Promise<HatchRecord[]> {
  const rows = await many<
    RowDataPacket & {
      id: string;
      hatched_on: Date | string;
      eggs_set: number;
      live_chicks: number;
      losses: number;
      other_count: number;
      difference_note: string | null;
      chick_batch_id: string | null;
      chick_batch_code: string | null;
    }
  >(
    db,
    `SELECT h.id, h.hatched_on, h.eggs_set, h.live_chicks, h.losses, h.other_count, h.difference_note,
            h.chick_batch_id, b.code AS chick_batch_code
     FROM hatch_records h
     LEFT JOIN batches b ON b.id = h.chick_batch_id
     WHERE h.farm_id = ? AND h.incubation_batch_id = ?
     ORDER BY h.hatched_on DESC, h.created_at DESC`,
    [farmId, sittingId],
  );
  return rows.map((row) => ({
    id: row.id,
    hatchedOn: asDate(row.hatched_on),
    eggsSet: asNumber(row.eggs_set),
    liveChicks: asNumber(row.live_chicks),
    losses: asNumber(row.losses),
    otherCount: asNumber(row.other_count),
    differenceNote: row.difference_note,
    chickBatchId: row.chick_batch_id,
    chickBatchCode: row.chick_batch_code,
  }));
}
