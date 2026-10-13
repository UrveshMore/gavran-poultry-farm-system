import type { RowDataPacket } from 'mysql2/promise';
import { many, type Db } from '../../db/sql.js';

export type SearchHit = { kind: string; id: string; label: string };

async function hits(db: Db, kind: string, sql: string, params: Array<string | null>): Promise<SearchHit[]> {
  const rows = await many<RowDataPacket & { id: string; label: string }>(db, sql, params);
  return rows.map((row) => ({ kind, id: row.id, label: row.label }));
}

export async function searchSheds(db: Db, farmId: string, pattern: string): Promise<SearchHit[]> {
  return hits(
    db,
    'shed',
    `SELECT id, name AS label FROM sheds
     WHERE farm_id = ? AND (name LIKE ? ESCAPE '!' OR code LIKE ? ESCAPE '!')
     ORDER BY name LIMIT 20`,
    [farmId, pattern, pattern],
  );
}

export async function searchBatches(db: Db, farmId: string, pattern: string): Promise<SearchHit[]> {
  return hits(
    db,
    'batch',
    `SELECT id, code AS label FROM batches
     WHERE farm_id = ? AND (code LIKE ? ESCAPE '!' OR IFNULL(source_note, '') LIKE ? ESCAPE '!')
     ORDER BY code LIMIT 20`,
    [farmId, pattern, pattern],
  );
}

export async function searchTasks(db: Db, farmId: string, pattern: string): Promise<SearchHit[]> {
  return hits(
    db,
    'task',
    `SELECT id, title AS label FROM tasks
     WHERE farm_id = ? AND title LIKE ? ESCAPE '!'
     ORDER BY title LIMIT 20`,
    [farmId, pattern],
  );
}

export async function searchSuppliers(db: Db, farmId: string, pattern: string): Promise<SearchHit[]> {
  return hits(
    db,
    'supplier',
    `SELECT id, name AS label FROM suppliers
     WHERE farm_id = ? AND name LIKE ? ESCAPE '!'
     ORDER BY name LIMIT 20`,
    [farmId, pattern],
  );
}

export async function searchExpenses(db: Db, farmId: string, pattern: string): Promise<SearchHit[]> {
  return hits(
    db,
    'expense',
    `SELECT id, CONCAT(counterparty, ' ', IFNULL(notes, '')) AS label FROM expense_entries
     WHERE farm_id = ? AND (counterparty LIKE ? ESCAPE '!' OR IFNULL(notes, '') LIKE ? ESCAPE '!')
     ORDER BY occurred_on DESC LIMIT 20`,
    [farmId, pattern, pattern],
  );
}

export async function searchInvoices(db: Db, farmId: string, pattern: string): Promise<SearchHit[]> {
  return hits(
    db,
    'invoice',
    `SELECT id, notes AS label FROM invoice_documents
     WHERE farm_id = ? AND notes LIKE ? ESCAPE '!'
     ORDER BY issued_on DESC LIMIT 20`,
    [farmId, pattern],
  );
}

export async function searchAttendance(db: Db, farmId: string, pattern: string, userId: string | null): Promise<SearchHit[]> {
  return hits(
    db,
    'attendance',
    `SELECT id, CONCAT(method_label, ' ', note) AS label FROM attendance_records
     WHERE farm_id = ? AND (? IS NULL OR user_id = ?)
       AND (method_label LIKE ? ESCAPE '!' OR note LIKE ? ESCAPE '!')
     ORDER BY attended_on DESC LIMIT 20`,
    [farmId, userId, userId, pattern, pattern],
  );
}
