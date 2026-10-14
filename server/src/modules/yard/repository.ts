import { randomUUID } from 'node:crypto';
import type { RowDataPacket } from 'mysql2/promise';
import { exec, many, type Db } from '../../db/sql.js';

export type YardNote = {
  id: string;
  notedOn: string;
  kind: 'note' | 'let_out' | 'shut_in';
  notedTime: string | null;
  body: string;
};

function asDate(value: Date | string): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

function asTime(value: Date | string | null): string | null {
  if (value === null) return null;
  if (value instanceof Date) {
    const hours = String(value.getUTCHours()).padStart(2, '0');
    const minutes = String(value.getUTCMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  }
  return String(value).slice(0, 5);
}

export async function listNotes(db: Db, farmId: string): Promise<YardNote[]> {
  const rows = await many<
    RowDataPacket & { id: string; noted_on: Date | string; kind: YardNote['kind']; noted_time: Date | string | null; body: string }
  >(
    db,
    `SELECT id, noted_on, kind, noted_time, body
     FROM yard_notes
     WHERE farm_id = ?
     ORDER BY noted_on DESC, created_at DESC
     LIMIT 80`,
    [farmId],
  );
  return rows.map((row) => ({
    id: row.id,
    notedOn: asDate(row.noted_on),
    kind: row.kind,
    notedTime: asTime(row.noted_time),
    body: row.body,
  }));
}

export async function insertNote(
  db: Db,
  input: { farmId: string; notedOn: string; kind: YardNote['kind']; notedTime: string | null; body: string; createdBy: string },
): Promise<string> {
  const id = randomUUID();
  await exec(
    db,
    `INSERT INTO yard_notes (id, farm_id, noted_on, kind, noted_time, body, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, input.farmId, input.notedOn, input.kind, input.notedTime, input.body, input.createdBy],
  );
  return id;
}
