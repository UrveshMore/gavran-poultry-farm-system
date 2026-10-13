import type { RowDataPacket } from 'mysql2/promise';
import { asNumber, many, type Db } from '../../db/sql.js';

function asDate(value: Date | string): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

export type ReportFilters = { shedId: string; batchId: string; categoryId: string };

function optionalId(value: string): string | null {
  return value === '' ? null : value;
}

export async function eggRows(db: Db, farmId: string, from: string, to: string, filters: ReportFilters) {
  const rows = await many<RowDataPacket & { id: string; collected_on: Date | string; total: number | string }>(
    db,
    `SELECT c.id, c.collected_on, SUM(l.egg_count) AS total
     FROM egg_collections c
     JOIN egg_collection_lines l ON l.collection_id = c.id
     WHERE c.farm_id = ? AND c.collected_on BETWEEN ? AND ?
       AND (? IS NULL OR c.shed_id = ?)
       AND (? IS NULL OR c.batch_id = ?)
       AND (? IS NULL OR l.category_id = ?)
     GROUP BY c.id, c.collected_on
     ORDER BY c.collected_on, c.id`,
    [farmId, from, to, optionalId(filters.shedId), optionalId(filters.shedId), optionalId(filters.batchId), optionalId(filters.batchId), optionalId(filters.categoryId), optionalId(filters.categoryId)],
  );
  return rows.map((row) => ({ id: row.id, collectedOn: asDate(row.collected_on), eggCount: asNumber(row.total) }));
}

export async function hatchRows(db: Db, farmId: string, from: string, to: string, filters: ReportFilters) {
  const rows = await many<RowDataPacket & { id: string; hatched_on: Date | string; eggs_set: number; live_chicks: number }>(
    db,
    `SELECT id, hatched_on, eggs_set, live_chicks
     FROM hatch_records
     WHERE farm_id = ? AND hatched_on BETWEEN ? AND ?
       AND (? IS NULL)
       AND (? IS NULL OR chick_batch_id = ?)
       AND (? IS NULL)
     ORDER BY hatched_on, id`,
    [farmId, from, to, optionalId(filters.shedId), optionalId(filters.batchId), optionalId(filters.batchId), optionalId(filters.categoryId)],
  );
  return rows.map((row) => ({
    id: row.id,
    hatchedOn: asDate(row.hatched_on),
    eggsSet: Number(row.eggs_set),
    liveChicks: Number(row.live_chicks),
  }));
}

export async function lossRows(db: Db, farmId: string, from: string, to: string, filters: ReportFilters) {
  const rows = await many<RowDataPacket & { id: string; occurred_on: Date | string; bird_count: number; note: string }>(
    db,
    `SELECT l.id, l.occurred_on, l.bird_count, l.note
     FROM loss_incidents l
     WHERE l.farm_id = ? AND l.occurred_on BETWEEN ? AND ?
       AND (? IS NULL OR EXISTS (
         SELECT 1 FROM batch_movements m WHERE m.id = l.movement_id AND (m.from_shed_id = ? OR m.to_shed_id = ?)
       ))
       AND (? IS NULL OR EXISTS (
         SELECT 1 FROM batch_movements m WHERE m.id = l.movement_id AND m.batch_id = ?
       ))
       AND (? IS NULL)
     ORDER BY l.occurred_on, l.id`,
    [
      farmId, from, to,
      optionalId(filters.shedId), optionalId(filters.shedId), optionalId(filters.shedId),
      optionalId(filters.batchId), optionalId(filters.batchId),
      optionalId(filters.categoryId),
    ],
  );
  return rows.map((row) => ({ id: row.id, occurredOn: asDate(row.occurred_on), birdCount: Number(row.bird_count), note: row.note }));
}

export async function expenseRows(db: Db, farmId: string, from: string, to: string, filters: ReportFilters) {
  const rows = await many<RowDataPacket & { id: string; occurred_on: Date | string; direction: 'expense' | 'income'; amount: number | string; unit_label: string }>(
    db,
    `SELECT id, occurred_on, direction, amount, unit_label
     FROM expense_entries
     WHERE farm_id = ? AND occurred_on BETWEEN ? AND ?
       AND (? IS NULL)
       AND (? IS NULL OR batch_id = ?)
       AND (? IS NULL OR category_id = ?)
     ORDER BY occurred_on, id`,
    [farmId, from, to, optionalId(filters.shedId), optionalId(filters.batchId), optionalId(filters.batchId), optionalId(filters.categoryId), optionalId(filters.categoryId)],
  );
  return rows.map((row) => ({
    id: row.id,
    occurredOn: asDate(row.occurred_on),
    direction: row.direction,
    amount: asNumber(row.amount),
    unitLabel: row.unit_label,
  }));
}

export async function movementRows(db: Db, farmId: string, from: string, to: string, filters: ReportFilters) {
  const rows = await many<RowDataPacket & { id: string; occurred_on: Date | string; movement_type: string; bird_count: number; code: string }>(
    db,
    `SELECT m.id, m.occurred_on, m.movement_type, m.bird_count, b.code
     FROM batch_movements m
     JOIN batches b ON b.id = m.batch_id
     WHERE m.farm_id = ? AND m.occurred_on BETWEEN ? AND ?
       AND (? IS NULL OR m.from_shed_id = ? OR m.to_shed_id = ?)
       AND (? IS NULL OR m.batch_id = ?)
       AND (? IS NULL)
     ORDER BY m.occurred_on, b.code, m.id`,
    [
      farmId, from, to,
      optionalId(filters.shedId), optionalId(filters.shedId), optionalId(filters.shedId),
      optionalId(filters.batchId), optionalId(filters.batchId),
      optionalId(filters.categoryId),
    ],
  );
  return rows.map((row) => ({
    id: row.id,
    occurredOn: asDate(row.occurred_on),
    movementType: row.movement_type,
    birdCount: Number(row.bird_count),
    batchCode: row.code,
  }));
}

export async function attendanceRows(db: Db, farmId: string, from: string, to: string) {
  const rows = await many<RowDataPacket & { id: string; attended_on: Date | string; method_label: string }>(
    db,
    `SELECT id, attended_on, method_label FROM attendance_records
     WHERE farm_id = ? AND attended_on BETWEEN ? AND ? ORDER BY attended_on, id`,
    [farmId, from, to],
  );
  return rows.map((row) => ({ id: row.id, attendedOn: asDate(row.attended_on), methodLabel: row.method_label }));
}

export async function parentageRows(db: Db, farmId: string, from: string, to: string, filters: ReportFilters) {
  const rows = await many<RowDataPacket & { id: string; recorded_on: Date | string; sire_note: string; dam_note: string }>(
    db,
    `SELECT id, recorded_on, sire_note, dam_note FROM parentage_records
     WHERE farm_id = ? AND recorded_on BETWEEN ? AND ?
       AND (? IS NULL)
       AND (? IS NULL OR offspring_batch_id = ? OR sire_batch_id = ? OR dam_batch_id = ?)
       AND (? IS NULL)
     ORDER BY recorded_on, id`,
    [
      farmId, from, to, optionalId(filters.shedId),
      optionalId(filters.batchId), optionalId(filters.batchId), optionalId(filters.batchId), optionalId(filters.batchId),
      optionalId(filters.categoryId),
    ],
  );
  return rows.map((row) => ({ id: row.id, recordedOn: asDate(row.recorded_on), sireNote: row.sire_note, damNote: row.dam_note }));
}

export async function receiptRows(db: Db, farmId: string, from: string, to: string) {
  const rows = await many<RowDataPacket & { id: string; received_on: Date | string; accepted_quantity: string; rejected_quantity: string; unit_label: string }>(
    db,
    `SELECT id, received_on, accepted_quantity, rejected_quantity, unit_label FROM goods_receipts
     WHERE farm_id = ? AND received_on BETWEEN ? AND ? ORDER BY received_on, id`,
    [farmId, from, to],
  );
  return rows.map((row) => ({
    id: row.id,
    receivedOn: asDate(row.received_on),
    acceptedQuantity: asNumber(row.accepted_quantity),
    rejectedQuantity: asNumber(row.rejected_quantity),
    unitLabel: row.unit_label,
  }));
}

export async function invoiceDocumentRows(db: Db, farmId: string, from: string, to: string) {
  const rows = await many<RowDataPacket & { id: string; issued_on: Date | string; status: 'unposted' }>(
    db,
    `SELECT id, issued_on, status FROM invoice_documents
     WHERE farm_id = ? AND issued_on BETWEEN ? AND ? ORDER BY issued_on, id`,
    [farmId, from, to],
  );
  return rows.map((row) => ({ id: row.id, issuedOn: asDate(row.issued_on), status: row.status }));
}

export async function returnRows(db: Db, farmId: string, from: string, to: string) {
  const rows = await many<RowDataPacket & { id: string; returned_on: Date | string; description: string; quantity: string }>(
    db,
    `SELECT id, returned_on, description, quantity FROM sale_returns
     WHERE farm_id = ? AND returned_on BETWEEN ? AND ? ORDER BY returned_on, id`,
    [farmId, from, to],
  );
  return rows.map((row) => ({ id: row.id, returnedOn: asDate(row.returned_on), description: row.description, quantity: asNumber(row.quantity) }));
}
