import { eggCategoryInputSchema, eggCollectionInputSchema } from '@gavran/shared';
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
import {
  activeCategoryIds,
  findOpenBatch,
  findShed,
  insertCollection,
  insertEggCategory,
  listCollections,
  listEggCategories,
} from './repository.js';

type Actor = { user: AuthUser; requestId: string };
type IdempotencyInput = { key: string | null; method: string; path: string };

export async function getEggCategories(farmId: string) {
  return listEggCategories(pool, farmId);
}

export async function createEggCategory(actor: Actor, access: FarmAccess, body: unknown) {
  const input = eggCategoryInputSchema.parse(body);
  try {
    return await withTransaction(async (conn) => {
      const created = await insertEggCategory(conn, access.farmId, input.name, actor.user.id);
      await writeAudit(conn, {
        farmId: access.farmId,
        actorUserId: actor.user.id,
        action: 'egg_category.created',
        entityType: 'egg_category',
        entityId: created.id,
        requestId: actor.requestId,
        summary: { name: created.name },
      });
      return created;
    });
  } catch (error) {
    if (isDup(error)) throw new AppError(409, 'DUPLICATE_CODE', 'That egg sort name is already used.');
    throw error;
  }
}

export async function getEggCollections(farmId: string) {
  return listCollections(pool, farmId);
}

export async function createEggCollection(actor: Actor, access: FarmAccess, body: unknown, idempotency: IdempotencyInput) {
  const input = eggCollectionInputSchema.parse(body);
  const farm = await findFarmById(pool, access.farmId, false);
  if (!farm) throw new AppError(404, 'NOT_FOUND', 'Not found.');
  if (input.collectedOn > todayInTimeZone(farm.timezone)) {
    throw new AppError(422, 'VALIDATION_ERROR', 'That date is in the future.', { fields: { collectedOn: 'future_date' } });
  }
  const path = requestPath(idempotency.path);
  return withTransaction(async (conn) => {
    const reserved = await reserveIdempotency(conn, {
      userId: actor.user.id,
      farmId: access.farmId,
      key: idempotency.key,
      method: idempotency.method,
      path,
    });
    if (reserved.mode === 'replay') return reserved;
    if (input.batchId && !(await findOpenBatch(conn, access.farmId, input.batchId))) {
      throw new AppError(422, 'VALIDATION_ERROR', 'Choose an open batch on this farm.', { fields: { batchId: 'invalid_format' } });
    }
    if (input.shedId && !(await findShed(conn, access.farmId, input.shedId))) {
      throw new AppError(422, 'VALIDATION_ERROR', 'Choose a shed on this farm.', { fields: { shedId: 'invalid_format' } });
    }
    const known = await activeCategoryIds(conn, access.farmId, input.lines.map((line) => line.categoryId));
    if (input.lines.some((line) => !known.has(line.categoryId))) {
      throw new AppError(422, 'VALIDATION_ERROR', 'Choose egg sorts from this farm.', { fields: { lines: 'invalid_format' } });
    }
    const lines = input.lines.filter((line) => line.eggCount > 0);
    const total = lines.reduce((sum, line) => sum + line.eggCount, 0);
    const id = await insertCollection(conn, {
      farmId: access.farmId,
      batchId: input.batchId === '' ? null : input.batchId,
      shedId: input.shedId === '' ? null : input.shedId,
      collectedOn: input.collectedOn,
      shiftLabel: input.shiftLabel === '' ? null : input.shiftLabel,
      notes: input.notes === '' ? null : input.notes,
      createdBy: actor.user.id,
      lines,
    });
    await writeAudit(conn, {
      farmId: access.farmId,
      actorUserId: actor.user.id,
      action: 'egg.collected',
      entityType: 'egg_collection',
      entityId: id,
      requestId: actor.requestId,
      summary: { total, collectedOn: input.collectedOn },
    });
    const data = (await listCollections(conn, access.farmId)).find((item) => item.id === id);
    if (!data) throw new Error('Egg collection insert failed.');
    if (reserved.mode === 'new') await finishIdempotency(conn, reserved.id, 201, data);
    return { mode: 'created' as const, status: 201, data };
  });
}
