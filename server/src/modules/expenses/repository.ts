import { randomUUID } from 'node:crypto';
import type { RowDataPacket } from 'mysql2/promise';
import { asNumber, exec, many, one, type Db } from '../../db/sql.js';

export type ExpenseCategory = { id: string; name: string };
export type ExpenseDirection = 'expense' | 'income';
export type ExpenseEntry = {
  id: string;
  occurredOn: string;
  direction: ExpenseDirection;
  categoryId: string;
  categoryName: string;
  amount: number;
  unitLabel: string;
  counterparty: string | null;
  referenceNote: string | null;
  notes: string | null;
  batchId: string | null;
  batchCode: string | null;
  reversesEntryId: string | null;
  reversedById: string | null;
};

function asDate(value: Date | string): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

export async function listCategories(db: Db, farmId: string): Promise<ExpenseCategory[]> {
  const rows = await many<RowDataPacket & ExpenseCategory>(db, `SELECT id, name FROM expense_categories WHERE farm_id = ? ORDER BY name`, [farmId]);
  return rows.map((row) => ({ id: row.id, name: row.name }));
}

export async function insertCategory(db: Db, farmId: string, name: string, createdBy: string): Promise<string> {
  const id = randomUUID();
  await exec(db, `INSERT INTO expense_categories (id, farm_id, name, created_by) VALUES (?, ?, ?, ?)`, [id, farmId, name, createdBy]);
  return id;
}

export async function categoryExists(db: Db, farmId: string, categoryId: string): Promise<boolean> {
  const row = await one<RowDataPacket>(db, `SELECT id FROM expense_categories WHERE farm_id = ? AND id = ?`, [farmId, categoryId]);
  return Boolean(row);
}

export async function batchOnFarm(db: Db, farmId: string, batchId: string): Promise<boolean> {
  const row = await one<RowDataPacket>(db, `SELECT id FROM batches WHERE farm_id = ? AND id = ?`, [farmId, batchId]);
  return Boolean(row);
}

type EntryRow = RowDataPacket & {
  id: string;
  occurred_on: Date | string;
  direction: ExpenseDirection;
  category_id: string;
  category_name: string;
  amount: number | string;
  unit_label: string;
  counterparty: string | null;
  reference_note: string | null;
  notes: string | null;
  batch_id: string | null;
  batch_code: string | null;
  reverses_entry_id: string | null;
  reversed_by_id: string | null;
};

function mapEntry(row: EntryRow): ExpenseEntry {
  return {
    id: row.id,
    occurredOn: asDate(row.occurred_on),
    direction: row.direction,
    categoryId: row.category_id,
    categoryName: row.category_name,
    amount: asNumber(row.amount),
    unitLabel: row.unit_label,
    counterparty: row.counterparty,
    referenceNote: row.reference_note,
    notes: row.notes,
    batchId: row.batch_id,
    batchCode: row.batch_code,
    reversesEntryId: row.reverses_entry_id,
    reversedById: row.reversed_by_id,
  };
}

const ENTRY_SELECT = `
  SELECT e.id, e.occurred_on, e.direction, e.category_id, c.name AS category_name,
         e.amount, e.unit_label, e.counterparty, e.reference_note, e.notes,
         e.batch_id, b.code AS batch_code, e.reverses_entry_id, rev.id AS reversed_by_id
  FROM expense_entries e
  JOIN expense_categories c ON c.id = e.category_id
  LEFT JOIN batches b ON b.id = e.batch_id
  LEFT JOIN expense_entries rev ON rev.reverses_entry_id = e.id
`;

export async function listEntries(db: Db, farmId: string): Promise<ExpenseEntry[]> {
  const rows = await many<EntryRow>(db, `${ENTRY_SELECT} WHERE e.farm_id = ? ORDER BY e.occurred_on DESC, e.created_at DESC LIMIT 100`, [farmId]);
  return rows.map(mapEntry);
}

export async function findEntry(db: Db, farmId: string, entryId: string): Promise<ExpenseEntry | null> {
  const row = await one<EntryRow>(db, `${ENTRY_SELECT} WHERE e.farm_id = ? AND e.id = ?`, [farmId, entryId]);
  return row ? mapEntry(row) : null;
}

export async function insertEntry(
  db: Db,
  input: {
    farmId: string;
    occurredOn: string;
    direction: ExpenseDirection;
    categoryId: string;
    amount: number;
    unitLabel: string;
    counterparty: string | null;
    referenceNote: string | null;
    notes: string | null;
    batchId: string | null;
    reversesEntryId: string | null;
    createdBy: string;
  },
): Promise<string> {
  const id = randomUUID();
  await exec(
    db,
    `INSERT INTO expense_entries (
      id, farm_id, occurred_on, direction, category_id, amount, unit_label,
      counterparty, reference_note, notes, batch_id, reverses_entry_id, created_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.farmId,
      input.occurredOn,
      input.direction,
      input.categoryId,
      input.amount,
      input.unitLabel,
      input.counterparty,
      input.referenceNote,
      input.notes,
      input.batchId,
      input.reversesEntryId,
      input.createdBy,
    ],
  );
  return id;
}
