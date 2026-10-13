import { randomUUID } from 'node:crypto';
import type { RowDataPacket } from 'mysql2/promise';
import { exec, many, one, type Db } from '../../db/sql.js';

export type ReportSchedule = { id: string; name: string; note: string; namedOn: string };

function day(value: Date | string): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

function map(row: RowDataPacket & { id: string; name: string; note: string; named_on: Date | string }): ReportSchedule {
  return { id: row.id, name: row.name, note: row.note, namedOn: day(row.named_on) };
}

export async function listSchedules(db: Db, farmId: string): Promise<ReportSchedule[]> {
  const rows = await many<RowDataPacket & { id: string; name: string; note: string; named_on: Date | string }>(
    db,
    `SELECT id, name, note, named_on FROM report_schedules WHERE farm_id = ? ORDER BY named_on, name`,
    [farmId],
  );
  return rows.map(map);
}

export async function insertSchedule(
  db: Db,
  input: { farmId: string; name: string; note: string; namedOn: string; createdBy: string },
): Promise<string> {
  const id = randomUUID();
  await exec(
    db,
    `INSERT INTO report_schedules (id, farm_id, name, note, named_on, created_by) VALUES (?, ?, ?, ?, ?, ?)`,
    [id, input.farmId, input.name, input.note, input.namedOn, input.createdBy],
  );
  return id;
}

export async function findSchedule(db: Db, farmId: string, id: string): Promise<ReportSchedule | null> {
  const row = await one<RowDataPacket & { id: string; name: string; note: string; named_on: Date | string }>(
    db,
    `SELECT id, name, note, named_on FROM report_schedules WHERE farm_id = ? AND id = ?`,
    [farmId, id],
  );
  return row ? map(row) : null;
}
