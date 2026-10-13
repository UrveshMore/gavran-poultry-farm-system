import {
  batchInputSchema,
  birdTypeInputSchema,
  closeBatchSchema,
  movementInputSchema,
  rangeAreaInputSchema,
  sexCountInputSchema,
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
  insertRangeArea,
  insertSexCount,
  listBatches,
  listBirdTypes,
  listMovements,
  listRangeAreas,
  listSexCounts,
  lockSheds,
  rangeAreaExists,
  rangeLiveCount,
  batchOnFarm,
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
      const created = await insertBirdType(conn, access.farmId, input.name, input.strainNote === '' ? null : input.strainNote, actor.user.id);
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
  const fromShedId = input.fromShedId === '' ? null : input.fromShedId;
  const toShedId = input.movementType === 'transfer' || input.movementType === 'from_range' ? input.toShedId || null : null;
  const toRangeAreaId = input.movementType === 'to_range' ? input.toRangeAreaId : null;
  const fromRangeAreaId = input.movementType === 'from_range' || input.fromRangeAreaId !== '' ? (input.fromRangeAreaId === '' ? null : input.fromRangeAreaId) : null;
  return withTransaction(async (conn) => {
    const reserved = await reserveIdempotency(conn, {
      userId: actor.user.id,
      farmId: access.farmId,
      key: idempotency.key,
      method: idempotency.method,
      path,
    });
    if (reserved.mode === 'replay') return reserved;
    const shedIds = [fromShedId, toShedId].filter((id): id is string => Boolean(id));
    const sheds = await lockSheds(conn, access.farmId, shedIds);
    const batch = await findBatch(conn, access.farmId, batchId, true);
    if (!batch) throw new AppError(404, 'NOT_FOUND', 'Not found.');
    if (batch.status !== 'open') throw new AppError(409, 'BATCH_CLOSED', 'This batch is closed.');
    if (fromShedId) {
      const from = sheds.get(fromShedId);
      if (!from) throw new AppError(422, 'VALIDATION_ERROR', 'Choose a shed on this farm.', { fields: { fromShedId: 'invalid_format' } });
    }
    if (toShedId) {
      const to = sheds.get(toShedId);
      if (!to) throw new AppError(422, 'VALIDATION_ERROR', 'Choose a destination shed on this farm.', { fields: { toShedId: 'invalid_format' } });
      if (to.status !== 'active') throw new AppError(409, 'SHED_INACTIVE', 'Birds can be placed only in an active shed.');
      const destinationLive = await shedLiveCount(conn, access.farmId, toShedId);
      if (destinationLive + input.birdCount > to.usableCapacity) {
        throw new AppError(409, 'CAPACITY_EXCEEDED', 'That shed does not have room for this count.');
      }
    }
    if (toRangeAreaId && !(await rangeAreaExists(conn, access.farmId, toRangeAreaId))) {
      throw new AppError(422, 'VALIDATION_ERROR', 'Choose a range area on this farm.', { fields: { toRangeAreaId: 'invalid_format' } });
    }
    if (fromRangeAreaId && !(await rangeAreaExists(conn, access.farmId, fromRangeAreaId))) {
      throw new AppError(422, 'VALIDATION_ERROR', 'Choose a range area on this farm.', { fields: { fromRangeAreaId: 'invalid_format' } });
    }
    const available = fromShedId
      ? await batchShedLiveCount(conn, access.farmId, batchId, fromShedId)
      : fromRangeAreaId
        ? await rangeLiveCount(conn, access.farmId, batchId, fromRangeAreaId)
        : 0;
    if (input.birdCount > available) {
      throw new AppError(409, 'INSUFFICIENT_BIRDS', 'That place does not have that many birds in this batch.');
    }
    const movementType: MovementType = input.movementType;
    const movementId = await insertMovement(conn, {
      farmId: access.farmId,
      batchId,
      movementType,
      fromShedId,
      toShedId,
      fromRangeAreaId,
      toRangeAreaId,
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

export async function getRangeAreas(farmId: string) {
  return listRangeAreas(pool, farmId);
}

export async function createRangeArea(actor: Actor, access: FarmAccess, body: unknown, idempotency: IdempotencyInput) {
  const input = rangeAreaInputSchema.parse(body);
  const path = requestPath(idempotency.path);
  try {
    return await withTransaction(async (conn) => {
      const reserved = await reserveIdempotency(conn, { userId: actor.user.id, farmId: access.farmId, key: idempotency.key, method: idempotency.method, path });
      if (reserved.mode === 'replay') return reserved;
      const id = await insertRangeArea(conn, access.farmId, input.name, input.notes === '' ? null : input.notes, actor.user.id);
      await writeAudit(conn, { farmId: access.farmId, actorUserId: actor.user.id, action: 'range_area.created', entityType: 'range_area', entityId: id, requestId: actor.requestId, summary: { name: input.name } });
      const data = (await listRangeAreas(conn, access.farmId)).find((item) => item.id === id);
      if (!data) throw new Error('Range area insert failed.');
      if (reserved.mode === 'new') await finishIdempotency(conn, reserved.id, 201, data);
      return { mode: 'created' as const, status: 201, data };
    });
  } catch (error) {
    if (isDup(error)) throw new AppError(409, 'DUPLICATE_CODE', 'That name is already used.');
    throw error;
  }
}

export async function getSexCounts(farmId: string) {
  const rows = await listSexCounts(pool, farmId);
  return rows.map((row) => ({ ...row, ratio: { roosters: row.roosterCount, hens: row.henCount } }));
}

export async function createSexCount(actor: Actor, access: FarmAccess, body: unknown, idempotency: IdempotencyInput) {
  const input = sexCountInputSchema.parse(body);
  if (input.countedOn > (await farmToday(access.farmId))) {
    throw new AppError(422, 'VALIDATION_ERROR', 'That date is in the future.', { fields: { countedOn: 'too_big' } });
  }
  const path = requestPath(idempotency.path);
  return withTransaction(async (conn) => {
    const reserved = await reserveIdempotency(conn, { userId: actor.user.id, farmId: access.farmId, key: idempotency.key, method: idempotency.method, path });
    if (reserved.mode === 'replay') return reserved;
    if (input.batchId !== '' && !(await batchOnFarm(conn, access.farmId, input.batchId))) {
      throw new AppError(422, 'VALIDATION_ERROR', 'Choose a batch on this farm.', { fields: { batchId: 'invalid_format' } });
    }
    const id = await insertSexCount(conn, {
      farmId: access.farmId,
      batchId: input.batchId === '' ? null : input.batchId,
      countedOn: input.countedOn,
      roosterCount: input.roosterCount,
      henCount: input.henCount,
      createdBy: actor.user.id,
    });
    await writeAudit(conn, { farmId: access.farmId, actorUserId: actor.user.id, action: 'sex_count.recorded', entityType: 'sex_count', entityId: id, requestId: actor.requestId, summary: { name: `${input.roosterCount}:${input.henCount}` } });
    const data = (await listSexCounts(conn, access.farmId)).find((item) => item.id === id);
    if (!data) throw new Error('Sex count insert failed.');
    const bodyData = { ...data, ratio: { roosters: data.roosterCount, hens: data.henCount } };
    if (reserved.mode === 'new') await finishIdempotency(conn, reserved.id, 201, bodyData);
    return { mode: 'created' as const, status: 201, data: bodyData };
  });
}
