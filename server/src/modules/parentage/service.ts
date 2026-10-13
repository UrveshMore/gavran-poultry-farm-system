import { parentageInputSchema } from '@gavran/shared';
import { pool } from '../../db/pool.js';
import { withTransaction } from '../../db/transaction.js';
import { AppError } from '../../http/errors.js';
import { finishIdempotency, requestPath, reserveIdempotency } from '../../http/idempotency.js';
import { writeAudit } from '../audit/repository.js';
import type { AuthUser } from '../auth/types.js';
import { todayInTimeZone } from '../batches/service.js';
import type { FarmAccess } from '../farms/access.js';
import { findFarmById } from '../farms/repository.js';
import { batchOnFarm, insertParentage, listParentage } from './repository.js';

type Actor = { user: AuthUser; requestId: string };
type IdempotencyInput = { key: string | null; method: string; path: string };

export async function getParentage(farmId: string) {
  return { records: await listParentage(pool, farmId), pairing: { status: 'unset' as const } };
}

export async function createParentage(actor: Actor, access: FarmAccess, body: unknown, idempotency: IdempotencyInput) {
  const input = parentageInputSchema.parse(body);
  const farm = await findFarmById(pool, access.farmId, false);
  if (!farm) throw new AppError(404, 'NOT_FOUND', 'Not found.');
  if (input.recordedOn > todayInTimeZone(farm.timezone)) {
    throw new AppError(422, 'VALIDATION_ERROR', 'That date is in the future.', { fields: { recordedOn: 'too_big' } });
  }
  const offspringBatchId = input.offspringBatchId === '' ? null : input.offspringBatchId;
  const sireBatchId = input.sireBatchId === '' ? null : input.sireBatchId;
  const damBatchId = input.damBatchId === '' ? null : input.damBatchId;
  if (offspringBatchId && !(await batchOnFarm(pool, access.farmId, offspringBatchId))) {
    throw new AppError(422, 'VALIDATION_ERROR', 'Choose a batch on this farm.', { fields: { offspringBatchId: 'invalid_format' } });
  }
  if (sireBatchId && !(await batchOnFarm(pool, access.farmId, sireBatchId))) {
    throw new AppError(422, 'VALIDATION_ERROR', 'Choose a batch on this farm.', { fields: { sireBatchId: 'invalid_format' } });
  }
  if (damBatchId && !(await batchOnFarm(pool, access.farmId, damBatchId))) {
    throw new AppError(422, 'VALIDATION_ERROR', 'Choose a batch on this farm.', { fields: { damBatchId: 'invalid_format' } });
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
    const id = await insertParentage(conn, {
      farmId: access.farmId,
      recordedOn: input.recordedOn,
      offspringBatchId,
      sireNote: input.sireNote,
      damNote: input.damNote,
      sireBatchId,
      damBatchId,
      note: input.note,
      createdBy: actor.user.id,
    });
    await writeAudit(conn, {
      farmId: access.farmId,
      actorUserId: actor.user.id,
      action: 'parentage.recorded',
      entityType: 'parentage_record',
      entityId: id,
      requestId: actor.requestId,
      summary: { recordedOn: input.recordedOn },
    });
    const data = (await listParentage(conn, access.farmId)).find((row) => row.id === id);
    if (!data) throw new Error('Parentage insert failed.');
    if (reserved.mode === 'new') await finishIdempotency(conn, reserved.id, 201, data);
    return { mode: 'created' as const, status: 201, data };
  });
}
