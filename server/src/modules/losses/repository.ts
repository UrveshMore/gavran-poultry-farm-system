import { randomUUID } from 'node:crypto';
import type { RowDataPacket } from 'mysql2/promise';
import { exec, many, one, type Db } from '../../db/sql.js';

export type LossIncident = {
  id: string;
  occurredOn: string;
  birdCount: number;
  note: string;
  movementId: string | null;
  batchCode: string | null;
};

export type MortalityMovement = {
  id: string;
  occurredOn: string;
  birdCount: number;
  batchCode: string;
  reason: string | null;
};

function asDate(value: Date | string): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

export async function listIncidents(db: Db, farmId: string): Promise<LossIncident[]> {
  const rows = await many<
    RowDataPacket & {
      id: string;
      occurred_on: Date | string;
      bird_count: number;
      note: string;
      movement_id: string | null;
      batch_code: string | null;
    }
  >(
    db,
    `SELECT l.id, l.occurred_on, l.bird_count, l.note, l.movement_id, b.code AS batch_code
     FROM loss_incidents l
     LEFT JOIN batch_movements m ON m.id = l.movement_id
     LEFT JOIN batches b ON b.id = m.batch_id
     WHERE l.farm_id = ?
     ORDER BY l.occurred_on DESC, l.created_at DESC
     LIMIT 50`,
    [farmId],
  );
  return rows.map((row) => ({
    id: row.id,
    occurredOn: asDate(row.occurred_on),
    birdCount: Number(row.bird_count),
    note: row.note,
    movementId: row.movement_id,
    batchCode: row.batch_code,
  }));
}

export async function listMortality(db: Db, farmId: string): Promise<MortalityMovement[]> {
  const rows = await many<
    RowDataPacket & { id: string; occurred_on: Date | string; bird_count: number; batch_code: string; reason: string | null }
  >(
    db,
    `SELECT m.id, m.occurred_on, m.bird_count, b.code AS batch_code, m.reason
     FROM batch_movements m
     JOIN batches b ON b.id = m.batch_id
     WHERE m.farm_id = ? AND m.movement_type = 'mortality'
     ORDER BY m.occurred_on DESC
     LIMIT 50`,
    [farmId],
  );
  return rows.map((row) => ({
    id: row.id,
    occurredOn: asDate(row.occurred_on),
    birdCount: Number(row.bird_count),
    batchCode: row.batch_code,
    reason: row.reason,
  }));
}

export async function mortalityExists(db: Db, farmId: string, movementId: string): Promise<boolean> {
  const row = await one<RowDataPacket>(
    db,
    `SELECT id FROM batch_movements WHERE farm_id = ? AND id = ? AND movement_type = 'mortality'`,
    [farmId, movementId],
  );
  return Boolean(row);
}

export async function insertIncident(
  db: Db,
  input: { farmId: string; occurredOn: string; birdCount: number; note: string; movementId: string | null; createdBy: string },
): Promise<string> {
  const id = randomUUID();
  await exec(
    db,
    `INSERT INTO loss_incidents (id, farm_id, occurred_on, bird_count, note, movement_id, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, input.farmId, input.occurredOn, input.birdCount, input.note, input.movementId, input.createdBy],
  );
  return id;
}
