import { randomUUID } from 'node:crypto';
import type { RowDataPacket } from 'mysql2/promise';
import { asNumber, exec, many, one, type Db } from '../../db/sql.js';

export type Sitting = {
  id: string;
  code: string;
  mode: 'incubator' | 'broody_hen';
  incubatorId: string | null;
  incubatorCode: string | null;
  henName: string | null;
  startedOn: string;
  eggCount: number;
  notes: string | null;
  status: 'open' | 'closed';
};

export type CandlingLine = { label: string; eggCount: number };
export type Candling = { id: string; observedOn: string; inspectedCount: number; notes: string | null; lines: CandlingLine[] };

function asDate(value: Date | string): string {
  return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
}

export async function findIncubatorForLoad(db: Db, farmId: string, incubatorId: string) {
  return one<RowDataPacket & { id: string; status: 'in_service' | 'out_of_service'; capacity_eggs: number | null }>(
    db,
    `SELECT id, status, capacity_eggs FROM incubators WHERE farm_id = ? AND id = ?`,
    [farmId, incubatorId],
  );
}

export async function insertSitting(
  db: Db,
  input: {
    farmId: string;
    code: string;
    mode: 'incubator' | 'broody_hen';
    incubatorId: string | null;
    henName: string | null;
    startedOn: string;
    eggCount: number;
    notes: string | null;
    createdBy: string;
  },
): Promise<string> {
  const id = randomUUID();
  await exec(
    db,
    `INSERT INTO incubation_batches
      (id, farm_id, code, mode, incubator_id, hen_name, started_on, egg_count, notes, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, input.farmId, input.code, input.mode, input.incubatorId, input.henName, input.startedOn, input.eggCount, input.notes, input.createdBy],
  );
  return id;
}

export async function listSittings(db: Db, farmId: string): Promise<Sitting[]> {
  const rows = await many<
    RowDataPacket & {
      id: string;
      code: string;
      mode: 'incubator' | 'broody_hen';
      incubator_id: string | null;
      incubator_code: string | null;
      hen_name: string | null;
      started_on: Date | string;
      egg_count: number;
      notes: string | null;
      status: 'open' | 'closed';
    }
  >(
    db,
    `SELECT b.id, b.code, b.mode, b.incubator_id, i.code AS incubator_code, b.hen_name, b.started_on, b.egg_count, b.notes, b.status
     FROM incubation_batches b
     LEFT JOIN incubators i ON i.id = b.incubator_id
     WHERE b.farm_id = ?
     ORDER BY b.started_on DESC, b.created_at DESC
     LIMIT 50`,
    [farmId],
  );
  return rows.map((row) => ({
    id: row.id,
    code: row.code,
    mode: row.mode,
    incubatorId: row.incubator_id,
    incubatorCode: row.incubator_code,
    henName: row.hen_name,
    startedOn: asDate(row.started_on),
    eggCount: asNumber(row.egg_count),
    notes: row.notes,
    status: row.status,
  }));
}

export async function findOpenSitting(db: Db, farmId: string, id: string): Promise<boolean> {
  const row = await one<RowDataPacket>(db, `SELECT id FROM incubation_batches WHERE farm_id = ? AND id = ? AND status = 'open'`, [farmId, id]);
  return Boolean(row);
}

export async function insertCandling(
  db: Db,
  input: {
    farmId: string;
    sittingId: string;
    observedOn: string;
    inspectedCount: number;
    notes: string | null;
    createdBy: string;
    lines: Array<{ label: string; eggCount: number }>;
  },
): Promise<string> {
  const id = randomUUID();
  await exec(
    db,
    `INSERT INTO candling_records (id, farm_id, incubation_batch_id, observed_on, inspected_count, notes, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, input.farmId, input.sittingId, input.observedOn, input.inspectedCount, input.notes, input.createdBy],
  );
  for (const line of input.lines) {
    await exec(db, `INSERT INTO candling_lines (id, record_id, label, egg_count) VALUES (?, ?, ?, ?)`, [
      randomUUID(),
      id,
      line.label,
      line.eggCount,
    ]);
  }
  return id;
}

export async function listCandling(db: Db, farmId: string, sittingId: string): Promise<Candling[]> {
  const rows = await many<RowDataPacket & { id: string; observed_on: Date | string; inspected_count: number; notes: string | null }>(
    db,
    `SELECT id, observed_on, inspected_count, notes FROM candling_records
     WHERE farm_id = ? AND incubation_batch_id = ?
     ORDER BY observed_on DESC, created_at DESC`,
    [farmId, sittingId],
  );
  if (rows.length === 0) return [];
  const ids = rows.map((row) => row.id);
  const lines = await many<RowDataPacket & { record_id: string; label: string; egg_count: number }>(
    db,
    `SELECT record_id, label, egg_count FROM candling_lines WHERE record_id IN (${ids.map(() => '?').join(', ')}) ORDER BY label`,
    ids,
  );
  return rows.map((row) => ({
    id: row.id,
    observedOn: asDate(row.observed_on),
    inspectedCount: asNumber(row.inspected_count),
    notes: row.notes,
    lines: lines
      .filter((line) => line.record_id === row.id)
      .map((line) => ({ label: line.label, eggCount: asNumber(line.egg_count) })),
  }));
}
