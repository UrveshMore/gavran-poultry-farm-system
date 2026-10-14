import { incubatorInputSchema, incubatorMaintenanceInputSchema, incubatorReadingInputSchema } from '@gavran/shared';
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
import { findIncubator, insertIncubator, insertMaintenance, insertReading, listIncubators, listMaintenance, listReadings } from './repository.js';

type Actor = { user: AuthUser; requestId: string };
type IdempotencyInput = { key: string | null; method: string; path: string };

function blankToNull(value: string): string | null {
  return value === '' ? null : value;
}

export async function getIncubators(farmId: string) {
  return listIncubators(pool, farmId);
}

export async function getIncubator(farmId: string, incubatorId: string) {
  const incubator = await findIncubator(pool, farmId, incubatorId);
  if (!incubator) throw new AppError(404, 'NOT_FOUND', 'Not found.');
  const [readings, maintenance] = await Promise.all([
    listReadings(pool, farmId, incubatorId),
    listMaintenance(pool, farmId, incubatorId),
  ]);
  return { incubator, readings, maintenance };
}

async function farmToday(farmId: string): Promise<string> {
  const farm = await findFarmById(pool, farmId, false);
  if (!farm) throw new AppError(404, 'NOT_FOUND', 'Not found.');
  return todayInTimeZone(farm.timezone);
}

export async function createIncubator(actor: Actor, access: FarmAccess, body: unknown, idempotency: IdempotencyInput) {
  const input = incubatorInputSchema.parse(body);
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
      const id = await insertIncubator(conn, {
        farmId: access.farmId,
        code: input.code.toUpperCase(),
        name: input.name,
        capacityEggs: input.capacityEggs,
        notes: blankToNull(input.notes),
        createdBy: actor.user.id,
      });
      await writeAudit(conn, {
        farmId: access.farmId,
        actorUserId: actor.user.id,
        action: 'incubator.created',
        entityType: 'incubator',
        entityId: id,
        requestId: actor.requestId,
        summary: { code: input.code.toUpperCase(), name: input.name },
      });
      const data = await findIncubator(conn, access.farmId, id);
      if (!data) throw new Error('Incubator insert failed.');
      if (reserved.mode === 'new') await finishIdempotency(conn, reserved.id, 201, data);
      return { mode: 'created' as const, status: 201, data };
    });
  } catch (error) {
    if (isDup(error)) throw new AppError(409, 'DUPLICATE_CODE', 'That code is already used.');
    throw error;
  }
}

export async function createReading(actor: Actor, access: FarmAccess, incubatorId: string, body: unknown, idempotency: IdempotencyInput) {
  const input = incubatorReadingInputSchema.parse(body);
  const today = await farmToday(access.farmId);
  if (input.recordedOn > today) {
    throw new AppError(422, 'VALIDATION_ERROR', 'That date is in the future.', { fields: { recordedOn: 'future_date' } });
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
    if (!(await findIncubator(conn, access.farmId, incubatorId))) {
      throw new AppError(404, 'NOT_FOUND', 'Not found.');
    }
    const id = await insertReading(conn, {
      farmId: access.farmId,
      incubatorId,
      recordedOn: input.recordedOn,
      recordedTime: input.recordedTime === '' ? null : `${input.recordedTime}:00`,
      temperatureValue: input.temperature.value,
      temperatureUnit: blankToNull(input.temperature.unit),
      humidityValue: input.humidity.value,
      humidityUnit: blankToNull(input.humidity.unit),
      powerStatus: input.powerStatus,
      source: input.source,
      notes: blankToNull(input.notes),
      createdBy: actor.user.id,
    });
    await writeAudit(conn, {
      farmId: access.farmId,
      actorUserId: actor.user.id,
      action: 'incubator.reading',
      entityType: 'incubator_reading',
      entityId: id,
      requestId: actor.requestId,
      summary: { incubatorId, recordedOn: input.recordedOn },
    });
    const data = (await listReadings(conn, access.farmId, incubatorId)).find((item) => item.id === id);
    if (!data) throw new Error('Incubator reading insert failed.');
    if (reserved.mode === 'new') await finishIdempotency(conn, reserved.id, 201, data);
    return { mode: 'created' as const, status: 201, data };
  });
}

export async function createMaintenance(actor: Actor, access: FarmAccess, incubatorId: string, body: unknown, idempotency: IdempotencyInput) {
  const input = incubatorMaintenanceInputSchema.parse(body);
  const today = await farmToday(access.farmId);
  if (input.occurredOn > today) {
    throw new AppError(422, 'VALIDATION_ERROR', 'That date is in the future.', { fields: { occurredOn: 'future_date' } });
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
    if (!(await findIncubator(conn, access.farmId, incubatorId))) {
      throw new AppError(404, 'NOT_FOUND', 'Not found.');
    }
    const id = await insertMaintenance(conn, {
      farmId: access.farmId,
      incubatorId,
      occurredOn: input.occurredOn,
      status: input.status,
      notes: blankToNull(input.notes),
      createdBy: actor.user.id,
    });
    await writeAudit(conn, {
      farmId: access.farmId,
      actorUserId: actor.user.id,
      action: 'incubator.maintenance',
      entityType: 'incubator_maintenance',
      entityId: id,
      requestId: actor.requestId,
      summary: { incubatorId, status: input.status },
    });
    const data = await findIncubator(conn, access.farmId, incubatorId);
    if (!data) throw new Error('Incubator update failed.');
    if (reserved.mode === 'new') await finishIdempotency(conn, reserved.id, 201, data);
    return { mode: 'created' as const, status: 201, data };
  });
}
