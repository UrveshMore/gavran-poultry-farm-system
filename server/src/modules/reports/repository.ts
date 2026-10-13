import type { RowDataPacket } from 'mysql2/promise';
import { asNumber, many, type Db } from '../../db/sql.js';

function asDate(value: Date | string): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

export async function eggRows(db: Db, farmId: string, from: string, to: string) {
  const rows = await many<RowDataPacket & { id: string; collected_on: Date | string; total: number | string }>(
    db,
    `SELECT c.id, c.collected_on, SUM(l.egg_count) AS total
     FROM egg_collections c
     JOIN egg_collection_lines l ON l.collection_id = c.id
     WHERE c.farm_id = ? AND c.collected_on BETWEEN ? AND ?
     GROUP BY c.id, c.collected_on
     ORDER BY c.collected_on, c.id`,
    [farmId, from, to],
  );
  return rows.map((row) => ({ id: row.id, collectedOn: asDate(row.collected_on), eggCount: asNumber(row.total) }));
}

export async function hatchRows(db: Db, farmId: string, from: string, to: string) {
  const rows = await many<RowDataPacket & { id: string; hatched_on: Date | string; eggs_set: number; live_chicks: number }>(
    db,
    `SELECT id, hatched_on, eggs_set, live_chicks
     FROM hatch_records
     WHERE farm_id = ? AND hatched_on BETWEEN ? AND ?
     ORDER BY hatched_on, id`,
    [farmId, from, to],
  );
  return rows.map((row) => ({
    id: row.id,
    hatchedOn: asDate(row.hatched_on),
    eggsSet: Number(row.eggs_set),
    liveChicks: Number(row.live_chicks),
  }));
}

export async function lossRows(db: Db, farmId: string, from: string, to: string) {
  const rows = await many<RowDataPacket & { id: string; occurred_on: Date | string; bird_count: number; note: string }>(
    db,
    `SELECT id, occurred_on, bird_count, note
     FROM loss_incidents
     WHERE farm_id = ? AND occurred_on BETWEEN ? AND ?
     ORDER BY occurred_on, id`,
    [farmId, from, to],
  );
  return rows.map((row) => ({ id: row.id, occurredOn: asDate(row.occurred_on), birdCount: Number(row.bird_count), note: row.note }));
}

export async function expenseRows(db: Db, farmId: string, from: string, to: string) {
  const rows = await many<RowDataPacket & { id: string; occurred_on: Date | string; direction: 'expense' | 'income'; amount: number | string; unit_label: string }>(
    db,
    `SELECT id, occurred_on, direction, amount, unit_label
     FROM expense_entries
     WHERE farm_id = ? AND occurred_on BETWEEN ? AND ?
     ORDER BY occurred_on, id`,
    [farmId, from, to],
  );
  return rows.map((row) => ({
    id: row.id,
    occurredOn: asDate(row.occurred_on),
    direction: row.direction,
    amount: asNumber(row.amount),
    unitLabel: row.unit_label,
  }));
}

export async function movementRows(db: Db, farmId: string, from: string, to: string) {
  const rows = await many<RowDataPacket & { id: string; occurred_on: Date | string; movement_type: string; bird_count: number; code: string }>(
    db,
    `SELECT m.id, m.occurred_on, m.movement_type, m.bird_count, b.code
     FROM batch_movements m
     JOIN batches b ON b.id = m.batch_id
     WHERE m.farm_id = ? AND m.occurred_on BETWEEN ? AND ?
     ORDER BY m.occurred_on, b.code, m.id`,
    [farmId, from, to],
  );
  return rows.map((row) => ({
    id: row.id,
    occurredOn: asDate(row.occurred_on),
    movementType: row.movement_type,
    birdCount: Number(row.bird_count),
    batchCode: row.code,
  }));
}
