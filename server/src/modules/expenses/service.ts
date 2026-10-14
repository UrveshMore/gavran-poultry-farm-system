import { expenseCategoryInputSchema, expenseEntryInputSchema, expenseReversalSchema } from '@gavran/shared';
import { isDup } from '../../db/sql.js';
import { pool } from '../../db/pool.js';
import { withTransaction } from '../../db/transaction.js';
import { AppError } from '../../http/errors.js';
import { finishIdempotency, requestPath, reserveIdempotency } from '../../http/idempotency.js';
import { writeAudit } from '../audit/repository.js';
import type { AuthUser } from '../auth/types.js';
import { todayInTimeZone } from '../batches/service.js';
import type { FarmAccess } from '../farms/access.js';
import { findFarmById } from '../farms/repository.js';
import { batchOnFarm, categoryExists, findEntry, insertCategory, insertEntry, listCategories, listEntries } from './repository.js';

type Actor = { user: AuthUser; requestId: string };
type IdempotencyInput = { key: string | null; method: string; path: string };

const accountingBasis = { status: 'not_chosen' as const, reason: 'decision 9 is open' };

async function today(farmId: string): Promise<string> {
  const farm = await findFarmById(pool, farmId, false);
  if (!farm) throw new AppError(404, 'NOT_FOUND', 'Not found.');
  return todayInTimeZone(farm.timezone);
}

function blank(value: string): string | null {
  return value === '' ? null : value;
}

export async function getExpenses(farmId: string) {
  return { categories: await listCategories(pool, farmId), entries: await listEntries(pool, farmId), accountingBasis };
}

export async function createCategory(actor: Actor, access: FarmAccess, body: unknown, idempotency: IdempotencyInput) {
  const input = expenseCategoryInputSchema.parse(body);
  const path = requestPath(idempotency.path);
  try {
    return await withTransaction(async (conn) => {
      const reserved = await reserveIdempotency(conn, { userId: actor.user.id, farmId: access.farmId, key: idempotency.key, method: idempotency.method, path });
      if (reserved.mode === 'replay') return reserved;
      const id = await insertCategory(conn, access.farmId, input.name, actor.user.id);
      await writeAudit(conn, { farmId: access.farmId, actorUserId: actor.user.id, action: 'expense_category.created', entityType: 'expense_category', entityId: id, requestId: actor.requestId, summary: { name: input.name } });
      const data = (await listCategories(conn, access.farmId)).find((item) => item.id === id);
      if (!data) throw new Error('Category insert failed.');
      if (reserved.mode === 'new') await finishIdempotency(conn, reserved.id, 201, data);
      return { mode: 'created' as const, status: 201, data };
    });
  } catch (error) {
    if (isDup(error)) throw new AppError(409, 'DUPLICATE_CODE', 'That category name is already used.');
    throw error;
  }
}

export async function createEntry(actor: Actor, access: FarmAccess, body: unknown, idempotency: IdempotencyInput) {
  const input = expenseEntryInputSchema.parse(body);
  if (input.occurredOn > (await today(access.farmId))) {
    throw new AppError(422, 'VALIDATION_ERROR', 'That date is in the future.', { fields: { occurredOn: 'future_date' } });
  }
  const path = requestPath(idempotency.path);
  return withTransaction(async (conn) => {
    const reserved = await reserveIdempotency(conn, { userId: actor.user.id, farmId: access.farmId, key: idempotency.key, method: idempotency.method, path });
    if (reserved.mode === 'replay') return reserved;
    if (!(await categoryExists(conn, access.farmId, input.categoryId))) {
      throw new AppError(422, 'VALIDATION_ERROR', 'Choose a category on this farm.', { fields: { categoryId: 'invalid_format' } });
    }
    if (input.batchId !== '' && !(await batchOnFarm(conn, access.farmId, input.batchId))) {
      throw new AppError(422, 'VALIDATION_ERROR', 'Choose a batch on this farm.', { fields: { batchId: 'invalid_format' } });
    }
    const id = await insertEntry(conn, {
      farmId: access.farmId,
      occurredOn: input.occurredOn,
      direction: input.direction,
      categoryId: input.categoryId,
      amount: input.amount,
      unitLabel: input.unitLabel,
      counterparty: blank(input.counterparty),
      referenceNote: blank(input.referenceNote),
      notes: blank(input.notes),
      batchId: input.batchId === '' ? null : input.batchId,
      reversesEntryId: null,
      createdBy: actor.user.id,
    });
    await writeAudit(conn, { farmId: access.farmId, actorUserId: actor.user.id, action: 'expense.recorded', entityType: 'expense_entry', entityId: id, requestId: actor.requestId, summary: { name: input.direction } });
    const data = await findEntry(conn, access.farmId, id);
    if (!data) throw new Error('Expense insert failed.');
    if (reserved.mode === 'new') await finishIdempotency(conn, reserved.id, 201, data);
    return { mode: 'created' as const, status: 201, data };
  });
}

export async function reverseEntry(actor: Actor, access: FarmAccess, entryId: string, body: unknown, idempotency: IdempotencyInput) {
  const input = expenseReversalSchema.parse(body);
  if (input.occurredOn > (await today(access.farmId))) {
    throw new AppError(422, 'VALIDATION_ERROR', 'That date is in the future.', { fields: { occurredOn: 'future_date' } });
  }
  const path = requestPath(idempotency.path);
  try {
    return await withTransaction(async (conn) => {
      const reserved = await reserveIdempotency(conn, { userId: actor.user.id, farmId: access.farmId, key: idempotency.key, method: idempotency.method, path });
      if (reserved.mode === 'replay') return reserved;
      const original = await findEntry(conn, access.farmId, entryId);
      if (!original) throw new AppError(404, 'NOT_FOUND', 'Not found.');
      if (original.reversedById) throw new AppError(409, 'ALREADY_REVERSED', 'That row already has a reversing entry.');
      const id = await insertEntry(conn, {
        farmId: access.farmId,
        occurredOn: input.occurredOn,
        direction: original.direction,
        categoryId: original.categoryId,
        amount: original.amount,
        unitLabel: original.unitLabel,
        counterparty: original.counterparty,
        referenceNote: original.referenceNote,
        notes: input.note,
        batchId: original.batchId,
        reversesEntryId: original.id,
        createdBy: actor.user.id,
      });
      await writeAudit(conn, { farmId: access.farmId, actorUserId: actor.user.id, action: 'expense.reversed', entityType: 'expense_entry', entityId: id, requestId: actor.requestId, summary: { name: original.id } });
      const data = await findEntry(conn, access.farmId, id);
      if (!data) throw new Error('Reversal insert failed.');
      if (reserved.mode === 'new') await finishIdempotency(conn, reserved.id, 201, data);
      return { mode: 'created' as const, status: 201, data };
    });
  } catch (error) {
    if (isDup(error)) throw new AppError(409, 'ALREADY_REVERSED', 'That row already has a reversing entry.');
    throw error;
  }
}
