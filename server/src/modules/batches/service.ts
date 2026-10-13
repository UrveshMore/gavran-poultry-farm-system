import {
  batchInputSchema,
  birdTypeInputSchema,
  closeBatchSchema,
  movementInputSchema,
  type MovementType,
} from '@gavran/shared';
import { isDup } from '../../db/sql.js';
import { withTransaction } from '../../db/transaction.js';
import { pool } from '../../db/pool.js';
import { AppError } from '../../http/errors.js';
import { finishIdempotency, requestPath, reserveIdempotency } from '../../http/idempotency.js';
import { writeAudit } from '../audit/repository.js';
import type { AuthUser } from '../auth/types.js';
import type { FarmAccess } from '../farms/access.js';
import { findFarmById } from '../farms/repository.js';
import {
  batchShedLiveCount,
  closeBatch,
  findActiveBirdType,
  findBatch,
  insertBatch,
  insertBirdType,
  insertMovement,
  listBatches,
  listBirdTypes,
  listMovements,
  lockSheds,
  shedLiveCount,
  type BatchRecord,
  type MovementRecord,
} from './repository.js';

type Actor = { user: AuthUser; requestId: string };
type IdempotencyInput = { key: string | null; method: string; path: string };

export function todayInTimeZone(timeZone: string, now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

function assertNotFuture(date: string, today: string, field: string) {
  if (date > today) {
    throw new AppError(422, 'VALIDATION_ERROR', 'That date is in the future.', { fields: { [field]: 'too_big' } });
  }
}

async function farmToday(farmId: string): Promise<string> {
  const farm = await findFarmById(pool, farmId, false);
  if (!farm) throw new AppError(404, 'NOT_FOUND', 'Not found.');
  return todayInTimeZone(farm.timezone);
}

export async function getBirdTypes(farmId: string) {
  return listBirdTypes(pool, farmId);
}

export async function createBirdType(actor: Actor, access: FarmAccess, body: unknown) {
  const input = birdTypeInputSchema.parse(body);
  try {
    return await withTransaction(async (conn) => {
      const created = await insertBirdType(conn, access.farmId, input.name, actor.user.id);
      await writeAudit(conn, {
        farmId: access.farmId,
        actorUserId: actor.user.id,
        action: 'bird_type.created',
        entityType: 'bird_type',
        entityId: created.id,
        requestId: actor.requestId,
        summary: { name: created.name },
      });
      return created;
    });
  } catch (error) {
    if (isDup(error)) throw new AppError(409, 'DUPLICATE_CODE', 'That bird type name is already used.');
    throw error;
  }
}

export async function getBatches(farmId: string) {
  return listBatches(pool, farmId);
}

export async function getBatch(farmId: string, batchId: string): Promise<{ batch: BatchRecord; movements: MovementRecord[] }> {
  const batch = await findBatch(pool, farmId, batchId, false);
  if (!batch) throw new AppError(404, 'NOT_FOUND', 'Not found.');
  return { batch, movements: await listMovements(pool, farmId, batchId) };
}

export async function createBatch(actor: Actor, access: FarmAccess, body: unknown, idempotency: IdempotencyInput) {
  const input = batchInputSchema.parse(body);
  const today = await farmToday(access.farmId);
  assertNotFuture(input.openedOn, today, 'openedOn');
  const path = requestPath(idempotency.path);
  try {
    return await withTransaction(async (conn) => {
      const reserved = await reserveIdempotency(conn, {
        userId: actor.user.id,
        farmId: access.farmId,
        key: idempotency.key,
        method: idempotency.method,
        path,
      });
      if (reserved.mode === 'replay') return reserved;
      const birdType = await findActiveBirdType(conn, access.farmId, input.birdTypeId);
      if (!birdType) throw new AppError(422, 'VALIDATION_ERROR', 'Choose a bird type for this farm.', { fields: { birdTypeId: 'invalid_format' } });
      const sheds = await lockSheds(conn, access.farmId, [input.shedId]);
      const shed = sheds.get(input.shedId);
      if (!shed) throw new AppError(422, 'VALIDATION_ERROR', 'Choose a shed on this farm.', { fields: { shedId: 'invalid_format' } });
      if (shed.status !== 'active') throw new AppError(409, 'SHED_INACTIVE', 'Birds can be placed only in an active shed.');
      const living = await shedLiveCount(conn, access.farmId, input.shedId);
      if (living + input.birdCount > shed.usableCapacity) {
        throw new AppError(409, 'CAPACITY_EXCEEDED', 'That shed does not have room for this count.');
      }
      const batchId = await insertBatch(conn, {
        farmId: access.farmId,
        code: input.code.toUpperCase(),
        birdTypeId: birdType.id,
        sourceNote: input.sourceNote === '' ? null : input.sourceNote,
        hatchDate: input.hatchDate === '' ? null : input.hatchDate,
        openedOn: input.openedOn,
        shedId: input.shedId,
        birdCount: input.birdCount,
        createdBy: actor.user.id,
      });
      await writeAudit(conn, {
        farmId: access.farmId,
        actorUserId: actor.user.id,
        action: 'batch.created',
        entityType: 'batch',
        entityId: batchId,
        requestId: actor.requestId,
        summary: { code: input.code.toUpperCase(), count: input.birdCount, birdType: birdType.name },
      });
      const batch = await findBatch(conn, access.farmId, batchId, false);
      if (!batch) throw new Error('Batch insert failed.');
      const data = batch;
      if (reserved.mode === 'new') await finishIdempotency(conn, reserved.id, 201, data);
      return { mode: 'created' as const, status: 201, data };
    });
  } catch (error) {
    if (isDup(error)) throw new AppError(409, 'DUPLICATE_CODE', 'That batch code is already used.');
    throw error;
  }
}

export async function createMovement(actor: Actor, access: FarmAccess, batchId: string, body: unknown, idempotency: IdempotencyInput) {
  const input = movementInputSchema.parse(body);
  const today = await farmToday(access.farmId);
  assertNotFuture(input.occurredOn, today, 'occurredOn');
  const path = requestPath(idempotency.path);
  const toShedId = input.movementType === 'transfer' ? input.toShedId : null;
  return withTransaction(async (conn) => {
    const reserved = await reserveIdempotency(conn, {
      userId: actor.user.id,
      farmId: access.farmId,
      key: idempotency.key,
      method: idempotency.method,
      path,
    });
    if (reserved.mode === 'replay') return reserved;
    const shedIds = [input.fromShedId, ...(toShedId ? [toShedId] : [])];
    const sheds = await lockSheds(conn, access.farmId, shedIds);
    const batch = await findBatch(conn, access.farmId, batchId, true);
    if (!batch) throw new AppError(404, 'NOT_FOUND', 'Not found.');
    if (batch.status !== 'open') throw new AppError(409, 'BATCH_CLOSED', 'This batch is closed.');
    const from = sheds.get(input.fromShedId);
    if (!from) throw new AppError(422, 'VALIDATION_ERROR', 'Choose a shed on this farm.', { fields: { fromShedId: 'invalid_format' } });
    if (toShedId) {
      const to = sheds.get(toShedId);
      if (!to) throw new AppError(422, 'VALIDATION_ERROR', 'Choose a destination shed on this farm.', { fields: { toShedId: 'invalid_format' } });
      if (to.status !== 'active') throw new AppError(409, 'SHED_INACTIVE', 'Birds can be placed only in an active shed.');
      const destinationLive = await shedLiveCount(conn, access.farmId, toShedId);
      if (destinationLive + input.birdCount > to.usableCapacity) {
        throw new AppError(409, 'CAPACITY_EXCEEDED', 'That shed does not have room for this count.');
      }
    }
    const available = await batchShedLiveCount(conn, access.farmId, batchId, input.fromShedId);
    if (input.birdCount > available) {
      throw new AppError(409, 'INSUFFICIENT_BIRDS', 'That shed does not have that many birds in this batch.');
    }
    const movementType: MovementType = input.movementType;
    const movementId = await insertMovement(conn, {
      farmId: access.farmId,
      batchId,
      movementType,
      fromShedId: input.fromShedId,
      toShedId,
      birdCount: input.birdCount,
      occurredOn: input.occurredOn,
      reason: input.reason === '' ? null : input.reason,
      createdBy: actor.user.id,
    });
    await writeAudit(conn, {
      farmId: access.farmId,
      actorUserId: actor.user.id,
      action: 'batch.movement',
      entityType: 'batch_movement',
      entityId: movementId,
      requestId: actor.requestId,
      summary: { code: batch.code, movementType, count: input.birdCount },
    });
    const updated = await findBatch(conn, access.farmId, batchId, false);
    if (!updated) throw new Error('Batch disappeared.');
    const data = { batch: updated, movementId };
    if (reserved.mode === 'new') await finishIdempotency(conn, reserved.id, 201, data);
    return { mode: 'created' as const, status: 201, data };
  });
}

export async function closeOpenBatch(actor: Actor, access: FarmAccess, batchId: string, body: unknown) {
  const input = closeBatchSchema.parse(body);
  return withTransaction(async (conn) => {
    const batch = await findBatch(conn, access.farmId, batchId, true);
    if (!batch) throw new AppError(404, 'NOT_FOUND', 'Not found.');
    if (batch.version !== input.version) throw new AppError(409, 'VERSION_CONFLICT', 'This batch was changed. Reload and try again.');
    if (batch.liveCount !== 0) throw new AppError(409, 'BIRDS_REMAIN', 'Close the batch only when the live count is zero.');
    const closed = await closeBatch(conn, batchId, input.version);
    if (!closed) throw new AppError(409, 'VERSION_CONFLICT', 'This batch was changed. Reload and try again.');
    await writeAudit(conn, {
      farmId: access.farmId,
      actorUserId: actor.user.id,
      action: 'batch.closed',
      entityType: 'batch',
      entityId: batchId,
      requestId: actor.requestId,
      summary: { code: batch.code },
    });
    const updated = await findBatch(conn, access.farmId, batchId, false);
    if (!updated) throw new Error('Batch disappeared.');
    return updated;
  });
}
