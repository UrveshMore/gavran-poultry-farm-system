import { proposedHatchRate, reportRangeSchema } from '@gavran/shared';
import { pool } from '../../db/pool.js';
import { AppError } from '../../http/errors.js';
import { todayInTimeZone } from '../batches/service.js';
import { findFarmById } from '../farms/repository.js';
import { eggRows, expenseRows, hatchRows, lossRows, movementRows } from './repository.js';

export async function buildReport(farmId: string, query: { from?: unknown; to?: unknown }) {
  const range = reportRangeSchema.parse({ from: query.from, to: query.to });
  const farm = await findFarmById(pool, farmId, false);
  if (!farm) throw new AppError(404, 'NOT_FOUND', 'Not found.');
  const today = todayInTimeZone(farm.timezone);
  if (range.to > today) {
    throw new AppError(422, 'VALIDATION_ERROR', 'That date is in the future.', { fields: { to: 'too_big' } });
  }
  const [eggs, hatches, losses, expenses, movements] = await Promise.all([
    eggRows(pool, farmId, range.from, range.to),
    hatchRows(pool, farmId, range.from, range.to),
    lossRows(pool, farmId, range.from, range.to),
    expenseRows(pool, farmId, range.from, range.to),
    movementRows(pool, farmId, range.from, range.to),
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
    ],
  };
}
