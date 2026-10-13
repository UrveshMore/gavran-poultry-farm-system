import { growthTargetInputSchema, stockItemInputSchema, stockMovementInputSchema, waterInputSchema, weighingInputSchema } from '@gavran/shared';
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
  findActiveBirdType,
  findBatch,
  findShed,
  insertItem,
  insertMovement,
  insertTarget,
  insertWater,
  insertWeighing,
  listItems,
  listMovements,
  listTargets,
  listWater,
  listWeighings,
  lockItem,
  onHand,
} from './repository.js';

type Actor = { user: AuthUser; requestId: string };
type IdempotencyInput = { key: string | null; method: string; path: string };

async function farmToday(farmId: string): Promise<string> {
  const farm = await findFarmById(pool, farmId, false);
  if (!farm) throw new AppError(404, 'NOT_FOUND', 'Not found.');
  return todayInTimeZone(farm.timezone);
}

function blank(value: string): string | null {
  return value === '' ? null : value;
}

export async function getItems(farmId: string) {
  return listItems(pool, farmId);
}

export async function createItem(actor: Actor, access: FarmAccess, body: unknown, idempotency: IdempotencyInput) {
  const input = stockItemInputSchema.parse(body);
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
      const id = await insertItem(conn, {
        farmId: access.farmId,
        name: input.name,
        unitLabel: input.unitLabel,
        reorderLevel: input.reorderLevel,
        notes: blank(input.notes),
        createdBy: actor.user.id,
      });
      await writeAudit(conn, {
        farmId: access.farmId,
        actorUserId: actor.user.id,
        action: 'stock_item.created',
        entityType: 'stock_item',
        entityId: id,
        requestId: actor.requestId,
        summary: { name: input.name, unitLabel: input.unitLabel },
      });
      const data = (await listItems(conn, access.farmId)).find((item) => item.id === id);
      if (!data) throw new Error('Stock item insert failed.');
      if (reserved.mode === 'new') await finishIdempotency(conn, reserved.id, 201, data);
      return { mode: 'created' as const, status: 201, data };
    });
  } catch (error) {
    if (isDup(error)) throw new AppError(409, 'DUPLICATE_CODE', 'That item name is already used.');
    throw error;
  }
}

export async function getMovements(farmId: string) {
  return listMovements(pool, farmId);
}

export async function createMovement(actor: Actor, access: FarmAccess, body: unknown, idempotency: IdempotencyInput) {
  const input = stockMovementInputSchema.parse(body);
  const today = await farmToday(access.farmId);
  if (input.occurredOn > today) {
    throw new AppError(422, 'VALIDATION_ERROR', 'That date is in the future.', { fields: { occurredOn: 'too_big' } });
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
    if (!(await lockItem(conn, access.farmId, input.itemId))) {
      throw new AppError(422, 'VALIDATION_ERROR', 'Choose an item on this farm.', { fields: { itemId: 'invalid_format' } });
    }
    if (input.batchId && !(await findBatch(conn, access.farmId, input.batchId))) {
      throw new AppError(422, 'VALIDATION_ERROR', 'Choose a batch on this farm.', { fields: { batchId: 'invalid_format' } });
    }
    if (input.shedId && !(await findShed(conn, access.farmId, input.shedId))) {
      throw new AppError(422, 'VALIDATION_ERROR', 'Choose a shed on this farm.', { fields: { shedId: 'invalid_format' } });
    }
    if (input.direction === 'out') {
      const available = await onHand(conn, input.itemId);
      if (available < input.quantity) throw new AppError(409, 'INSUFFICIENT_STOCK', 'That quantity is more than the quantity on hand.');
    }
    const id = await insertMovement(conn, {
      farmId: access.farmId,
      itemId: input.itemId,
      movementType: input.movementType,
      direction: input.direction,
      quantity: input.quantity,
      occurredOn: input.occurredOn,
      batchId: blank(input.batchId),
      shedId: blank(input.shedId),
      lotCode: blank(input.lotCode),
      expiresOn: blank(input.expiresOn),
      unitCost: input.unitCost,
      supplierName: blank(input.supplierName),
      reason: blank(input.reason),
      createdBy: actor.user.id,
    });
    await writeAudit(conn, {
      farmId: access.farmId,
      actorUserId: actor.user.id,
      action: 'stock_movement.recorded',
      entityType: 'stock_movement',
      entityId: id,
      requestId: actor.requestId,
      summary: { movementType: input.movementType, direction: input.direction, quantity: input.quantity },
    });
    const data = (await listMovements(conn, access.farmId)).find((item) => item.id === id);
    if (!data) throw new Error('Stock movement insert failed.');
    if (reserved.mode === 'new') await finishIdempotency(conn, reserved.id, 201, data);
    return { mode: 'created' as const, status: 201, data };
  });
}

export async function getWater(farmId: string) {
  return listWater(pool, farmId);
}

export async function createWater(actor: Actor, access: FarmAccess, body: unknown, idempotency: IdempotencyInput) {
  const input = waterInputSchema.parse(body);
  const today = await farmToday(access.farmId);
  if (input.recordedOn > today) {
    throw new AppError(422, 'VALIDATION_ERROR', 'That date is in the future.', { fields: { recordedOn: 'too_big' } });
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
    if (input.batchId && !(await findBatch(conn, access.farmId, input.batchId))) {
      throw new AppError(422, 'VALIDATION_ERROR', 'Choose a batch on this farm.', { fields: { batchId: 'invalid_format' } });
    }
    if (input.shedId && !(await findShed(conn, access.farmId, input.shedId))) {
      throw new AppError(422, 'VALIDATION_ERROR', 'Choose a shed on this farm.', { fields: { shedId: 'invalid_format' } });
    }
    const id = await insertWater(conn, {
      farmId: access.farmId,
      recordedOn: input.recordedOn,
      batchId: blank(input.batchId),
      shedId: blank(input.shedId),
      quantity: input.quantity,
      unitLabel: input.quantity === null ? null : input.unitLabel,
      sourceNote: blank(input.sourceNote),
      testNote: blank(input.testNote),
      notes: blank(input.notes),
      createdBy: actor.user.id,
    });
    await writeAudit(conn, {
      farmId: access.farmId,
      actorUserId: actor.user.id,
      action: 'water.recorded',
      entityType: 'water_record',
      entityId: id,
      requestId: actor.requestId,
      summary: { recordedOn: input.recordedOn, laboratoryResult: input.testNote !== '' },
    });
    const data = (await listWater(conn, access.farmId)).find((item) => item.id === id);
    if (!data) throw new Error('Water record insert failed.');
    if (reserved.mode === 'new') await finishIdempotency(conn, reserved.id, 201, data);
    return { mode: 'created' as const, status: 201, data };
  });
}

export async function getTargets(farmId: string) {
  return listTargets(pool, farmId);
}

export async function createTarget(actor: Actor, access: FarmAccess, body: unknown, idempotency: IdempotencyInput) {
  const input = growthTargetInputSchema.parse(body);
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
      if (!(await findActiveBirdType(conn, access.farmId, input.birdTypeId))) {
        throw new AppError(422, 'VALIDATION_ERROR', 'Choose a bird type on this farm.', { fields: { birdTypeId: 'invalid_format' } });
      }
      const id = await insertTarget(conn, { farmId: access.farmId, ...input, createdBy: actor.user.id });
      await writeAudit(conn, {
        farmId: access.farmId,
        actorUserId: actor.user.id,
        action: 'growth_target.created',
        entityType: 'growth_target',
        entityId: id,
        requestId: actor.requestId,
        summary: { ageDays: input.ageDays, targetWeight: input.targetWeight, weightUnit: input.weightUnit },
      });
      const data = (await listTargets(conn, access.farmId)).find((item) => item.id === id);
      if (!data) throw new Error('Growth target insert failed.');
      if (reserved.mode === 'new') await finishIdempotency(conn, reserved.id, 201, data);
      return { mode: 'created' as const, status: 201, data };
    });
  } catch (error) {
    if (isDup(error)) throw new AppError(409, 'DUPLICATE_CODE', 'That age already has a target for this bird type.');
    throw error;
  }
}

export async function getWeighings(farmId: string) {
  return listWeighings(pool, farmId);
}

export async function createWeighing(actor: Actor, access: FarmAccess, body: unknown, idempotency: IdempotencyInput) {
  const input = weighingInputSchema.parse(body);
  const today = await farmToday(access.farmId);
  if (input.weighedOn > today) {
    throw new AppError(422, 'VALIDATION_ERROR', 'That date is in the future.', { fields: { weighedOn: 'too_big' } });
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
    if (!(await findBatch(conn, access.farmId, input.batchId))) {
      throw new AppError(422, 'VALIDATION_ERROR', 'Choose a batch on this farm.', { fields: { batchId: 'invalid_format' } });
    }
    const id = await insertWeighing(conn, {
      farmId: access.farmId,
      batchId: input.batchId,
      weighedOn: input.weighedOn,
      ageDays: input.ageDays,
      weightValue: input.weightValue,
      weightUnit: input.weightUnit,
      birdCount: input.birdCount,
      notes: blank(input.notes),
      createdBy: actor.user.id,
    });
    await writeAudit(conn, {
      farmId: access.farmId,
      actorUserId: actor.user.id,
      action: 'weighing.recorded',
      entityType: 'growth_weighing',
      entityId: id,
      requestId: actor.requestId,
      summary: { weightValue: input.weightValue, weightUnit: input.weightUnit, ageDays: input.ageDays },
    });
    const data = (await listWeighings(conn, access.farmId)).find((item) => item.id === id);
    if (!data) throw new Error('Weighing insert failed.');
    if (reserved.mode === 'new') await finishIdempotency(conn, reserved.id, 201, data);
    return { mode: 'created' as const, status: 201, data };
  });
}
