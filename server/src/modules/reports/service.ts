import { proposedHatchRate, reportRangeSchema } from '@gavran/shared';
import { pool } from '../../db/pool.js';
import { AppError } from '../../http/errors.js';
import { todayInTimeZone } from '../batches/service.js';
import { findFarmById } from '../farms/repository.js';
import { attendanceRows, eggRows, expenseRows, hatchRows, invoiceDocumentRows, lossRows, movementRows, parentageRows, receiptRows, returnRows } from './repository.js';

export async function buildReport(farmId: string, query: { from?: unknown; to?: unknown; shedId?: unknown; batchId?: unknown; categoryId?: unknown }) {
  const range = reportRangeSchema.parse({
    from: query.from,
    to: query.to,
    shedId: query.shedId ?? '',
    batchId: query.batchId ?? '',
    categoryId: query.categoryId ?? '',
  });
  const farm = await findFarmById(pool, farmId, false);
  if (!farm) throw new AppError(404, 'NOT_FOUND', 'Not found.');
  const today = todayInTimeZone(farm.timezone);
  if (range.to > today) {
    throw new AppError(422, 'VALIDATION_ERROR', 'That date is in the future.', { fields: { to: 'too_big' } });
  }
  const filters = { shedId: range.shedId, batchId: range.batchId, categoryId: range.categoryId };
  const [eggs, hatches, losses, expenses, movements, attendance, parentage, receipts, invoiceDocuments, returns] = await Promise.all([
    eggRows(pool, farmId, range.from, range.to, filters),
    hatchRows(pool, farmId, range.from, range.to, filters),
    lossRows(pool, farmId, range.from, range.to, filters),
    expenseRows(pool, farmId, range.from, range.to, filters),
    movementRows(pool, farmId, range.from, range.to, filters),
    attendanceRows(pool, farmId, range.from, range.to),
    parentageRows(pool, farmId, range.from, range.to, filters),
    receiptRows(pool, farmId, range.from, range.to),
    invoiceDocumentRows(pool, farmId, range.from, range.to),
    returnRows(pool, farmId, range.from, range.to),
  ]);
  const listedSums = new Map<string, { direction: 'expense' | 'income'; unitLabel: string; amount: number }>();
  for (const row of expenses) {
    const key = `${row.direction}\0${row.unitLabel}`;
    const current = listedSums.get(key);
    const amount = Math.round(((current?.amount ?? 0) + row.amount) * 100) / 100;
    listedSums.set(key, { direction: row.direction, unitLabel: row.unitLabel, amount });
  }
  return {
    from: range.from,
    to: range.to,
    filters: { shedId: range.shedId, batchId: range.batchId, categoryId: range.categoryId },
    timezone: farm.timezone,
    generatedAt: new Date().toISOString(),
    offlinePending: 'none' as const,
    sections: [
      {
        id: 'movements' as const,
        sourceTable: 'batch_movements',
        formula: { status: 'ledger' as const, text: 'Rows are batch movements in this date range. This is not a mortality rate.' },
        rows: movements,
      },
      {
        id: 'eggs' as const,
        sourceTable: 'egg_collection_lines',
        formula: { status: 'sum' as const, text: 'Sum of egg counts on collection lines whose collection date is in this range.' },
        total: eggs.reduce((sum, row) => sum + row.eggCount, 0),
        rows: eggs,
      },
      {
        id: 'hatches' as const,
        sourceTable: 'hatch_records',
        formula: { status: 'proposed' as const, text: 'live chicks ÷ eggs set × 100' },
        rows: hatches.map((row) => ({ ...row, proposedHatchRate: proposedHatchRate(row.liveChicks, row.eggsSet) })),
      },
      {
        id: 'losses' as const,
        sourceTable: 'loss_incidents',
        formula: { status: 'not_calculated' as const, reason: 'decision 4 is open' },
        rows: losses,
      },
      {
        id: 'expenses' as const,
        sourceTable: 'expense_entries',
        formula: { status: 'not_chosen' as const, reason: 'decision 9 is open' },
        listedSums: [...listedSums.values()],
        rows: expenses,
      },
      {
        id: 'attendance' as const,
        sourceTable: 'attendance_records',
        formula: { status: 'row_count' as const, text: 'Count of attendance rows in this date range.' },
        rowCount: attendance.length,
        rows: attendance,
      },
      {
        id: 'parentage' as const,
        sourceTable: 'parentage_records',
        formula: { status: 'unset' as const, text: 'Parent notes in this date range.' },
        rows: parentage,
      },
      {
        id: 'receipts' as const,
        sourceTable: 'goods_receipts',
        formula: { status: 'not_posted' as const, text: 'Accepted and rejected quantities. Stock is unchanged.' },
        rows: receipts,
      },
      {
        id: 'invoiceDocuments' as const,
        sourceTable: 'invoice_documents',
        formula: { status: 'unposted' as const, text: 'Documents in this date range. Posting stays off.' },
        rows: invoiceDocuments,
      },
      {
        id: 'returns' as const,
        sourceTable: 'sale_returns',
        formula: { status: 'listed' as const, text: 'Return rows in this date range.' },
        rows: returns,
      },
    ],
  };
}
