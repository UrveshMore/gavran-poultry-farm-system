import { lossIncidentSchema } from '@gavran/shared';
import { pool } from '../../db/pool.js';
import { withTransaction } from '../../db/transaction.js';
import { AppError } from '../../http/errors.js';
import { finishIdempotency, requestPath, reserveIdempotency } from '../../http/idempotency.js';
import { writeAudit } from '../audit/repository.js';
import type { AuthUser } from '../auth/types.js';
import { todayInTimeZone } from '../batches/service.js';
import type { FarmAccess } from '../farms/access.js';
import { findFarmById } from '../farms/repository.js';
import { insertIncident, listIncidents, listMortality, mortalityExists } from './repository.js';

type Actor = { user: AuthUser; requestId: string };
type IdempotencyInput = { key: string | null; method: string; path: string };

export async function getLosses(farmId: string) {
  const farm = await findFarmById(pool, farmId, false);
  if (!farm) throw new AppError(404, 'NOT_FOUND', 'Not found.');
  return {
    incidents: await listIncidents(pool, farmId),
    mortalityMovements: await listMortality(pool, farmId),
    proposedMortalityRate: { status: 'not_calculated' as const, reason: 'decision 4 is open' },
    today: todayInTimeZone(farm.timezone),
  };
}

export async function createLoss(actor: Actor, access: FarmAccess, body: unknown, idempotency: IdempotencyInput) {
  const input = lossIncidentSchema.parse(body);
  const farm = await findFarmById(pool, access.farmId, false);
  if (!farm) throw new AppError(404, 'NOT_FOUND', 'Not found.');
  if (input.occurredOn > todayInTimeZone(farm.timezone)) {
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
    const movementId = input.movementId === '' ? null : input.movementId;
    if (movementId && !(await mortalityExists(conn, access.farmId, movementId))) {
      throw new AppError(422, 'VALIDATION_ERROR', 'Choose a mortality movement on this farm.', { fields: { movementId: 'invalid_format' } });
    }
    const id = await insertIncident(conn, {
      farmId: access.farmId,
      occurredOn: input.occurredOn,
      birdCount: input.birdCount,
      note: input.note,
      movementId,
      createdBy: actor.user.id,
    });
    await writeAudit(conn, {
      farmId: access.farmId,
      actorUserId: actor.user.id,
      action: 'loss.recorded',
      entityType: 'loss_incident',
      entityId: id,
      requestId: actor.requestId,
      summary: { birdCount: input.birdCount },
    });
    const data = (await listIncidents(conn, access.farmId)).find((item) => item.id === id);
    if (!data) throw new Error('Loss insert failed.');
    if (reserved.mode === 'new') await finishIdempotency(conn, reserved.id, 201, data);
    return { mode: 'created' as const, status: 201, data };
  });
}
