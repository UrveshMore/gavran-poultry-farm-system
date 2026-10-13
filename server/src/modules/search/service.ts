import { likePattern } from '@gavran/shared';
import { z } from 'zod';
import { pool } from '../../db/pool.js';
import { AppError } from '../../http/errors.js';
import type { FarmAccess } from '../farms/access.js';
import {
  searchAttendance,
  searchBatches,
  searchExpenses,
  searchInvoices,
  searchSheds,
  searchSuppliers,
  searchTasks,
  type SearchHit,
} from './repository.js';

const querySchema = z.object({ q: z.string().trim().min(2, 'too_small').max(80, 'too_big') });

export async function searchFarm(access: FarmAccess, userId: string, query: unknown) {
  const parsed = querySchema.parse(query);
  const pattern = likePattern(parsed.q);
  if (!pattern) throw new AppError(422, 'VALIDATION_ERROR', 'Check the highlighted fields.', { fields: { q: 'too_small' } });
  const hits: SearchHit[] = [];
  if (access.permissions.includes('shed.read')) hits.push(...(await searchSheds(pool, access.farmId, pattern)));
  if (access.permissions.includes('batch.read')) hits.push(...(await searchBatches(pool, access.farmId, pattern)));
  if (access.permissions.includes('task.read')) hits.push(...(await searchTasks(pool, access.farmId, pattern)));
  if (access.permissions.includes('supplier.read')) hits.push(...(await searchSuppliers(pool, access.farmId, pattern)));
  if (access.permissions.includes('expense.read')) hits.push(...(await searchExpenses(pool, access.farmId, pattern)));
  if (access.permissions.includes('sale.read')) hits.push(...(await searchInvoices(pool, access.farmId, pattern)));
  if (access.permissions.includes('attendance.read')) {
    const ownOnly = access.role !== 'owner' && access.role !== 'manager';
    hits.push(...(await searchAttendance(pool, access.farmId, pattern, ownOnly ? userId : null)));
  }
  return { query: parsed.q, hits };
}
