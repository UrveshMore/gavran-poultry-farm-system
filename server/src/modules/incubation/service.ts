import { candlingInputSchema, incubationInputSchema } from '@gavran/shared';
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
import { findIncubatorForLoad, findOpenSitting, insertCandling, insertSitting, listCandling, listSittings } from './repository.js';

type Actor = { user: AuthUser; requestId: string };
type IdempotencyInput = { key: string | null; method: string; path: string };

async function farmToday(farmId: string): Promise<string> {
  const farm = await findFarmById(pool, farmId, false);
  if (!farm) throw new AppError(404, 'NOT_FOUND', 'Not found.');
  return todayInTimeZone(farm.timezone);
}

export async function getSittings(farmId: string) {
  return listSittings(pool, farmId);
}

export async function getSitting(farmId: string, sittingId: string) {
  const sitting = (await listSittings(pool, farmId)).find((item) => item.id === sittingId);
  if (!sitting) throw new AppError(404, 'NOT_FOUND', 'Not found.');
  return { sitting, candling: await listCandling(pool, farmId, sittingId) };
}

export async function createSitting(actor: Actor, access: FarmAccess, body: unknown, idempotency: IdempotencyInput) {
  const input = incubationInputSchema.parse(body);
  const today = await farmToday(access.farmId);
  if (input.startedOn > today) {
    throw new AppError(422, 'VALIDATION_ERROR', 'That date is in the future.', { fields: { startedOn: 'too_big' } });
  }
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
      if (input.mode === 'incubator') {
        const machine = await findIncubatorForLoad(conn, access.farmId, input.incubatorId);
        if (!machine) throw new AppError(422, 'VALIDATION_ERROR', 'Choose an incubator on this farm.', { fields: { incubatorId: 'invalid_format' } });
        if (machine.status !== 'in_service') throw new AppError(409, 'INCUBATOR_OUT', 'That incubator is out of service.');
        if (machine.capacity_eggs !== null && input.eggCount > Number(machine.capacity_eggs)) {
          throw new AppError(409, 'INCUBATOR_CAPACITY', 'That incubator does not have room for this egg count.');
        }
      }
      const id = await insertSitting(conn, {
        farmId: access.farmId,
        code: input.code.toUpperCase(),
        mode: input.mode,
        incubatorId: input.mode === 'incubator' ? input.incubatorId : null,
        henName: input.mode === 'broody_hen' ? input.henName : null,
        startedOn: input.startedOn,
        eggCount: input.eggCount,
        notes: input.notes === '' ? null : input.notes,
        createdBy: actor.user.id,
      });
      await writeAudit(conn, {
        farmId: access.farmId,
        actorUserId: actor.user.id,
        action: 'incubation.started',
        entityType: 'incubation_batch',
        entityId: id,
        requestId: actor.requestId,
        summary: { code: input.code.toUpperCase(), mode: input.mode, eggCount: input.eggCount },
      });
      const data = (await listSittings(conn, access.farmId)).find((item) => item.id === id);
      if (!data) throw new Error('Incubation insert failed.');
      if (reserved.mode === 'new') await finishIdempotency(conn, reserved.id, 201, data);
      return { mode: 'created' as const, status: 201, data };
    });
  } catch (error) {
    if (isDup(error)) throw new AppError(409, 'DUPLICATE_CODE', 'That code is already used.');
    throw error;
  }
}

export async function createCandling(actor: Actor, access: FarmAccess, sittingId: string, body: unknown, idempotency: IdempotencyInput) {
  const input = candlingInputSchema.parse(body);
  const today = await farmToday(access.farmId);
  if (input.observedOn > today) {
    throw new AppError(422, 'VALIDATION_ERROR', 'That date is in the future.', { fields: { observedOn: 'too_big' } });
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
    if (!(await findOpenSitting(conn, access.farmId, sittingId))) throw new AppError(404, 'NOT_FOUND', 'Not found.');
    const id = await insertCandling(conn, {
      farmId: access.farmId,
      sittingId,
      observedOn: input.observedOn,
      inspectedCount: input.inspectedCount,
      notes: input.notes === '' ? null : input.notes,
      createdBy: actor.user.id,
      lines: input.lines,
    });
    await writeAudit(conn, {
      farmId: access.farmId,
      actorUserId: actor.user.id,
      action: 'incubation.candled',
      entityType: 'candling_record',
      entityId: id,
      requestId: actor.requestId,
      summary: { sittingId, inspectedCount: input.inspectedCount },
    });
    const data = (await listCandling(conn, access.farmId, sittingId)).find((item) => item.id === id);
    if (!data) throw new Error('Candling insert failed.');
    if (reserved.mode === 'new') await finishIdempotency(conn, reserved.id, 201, data);
    return { mode: 'created' as const, status: 201, data };
  });
}
