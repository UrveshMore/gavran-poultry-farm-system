import { yardNoteSchema } from '@gavran/shared';
import { pool } from '../../db/pool.js';
import { withTransaction } from '../../db/transaction.js';
import { AppError } from '../../http/errors.js';
import { finishIdempotency, requestPath, reserveIdempotency } from '../../http/idempotency.js';
import { writeAudit } from '../audit/repository.js';
import type { AuthUser } from '../auth/types.js';
import { todayInTimeZone } from '../batches/service.js';
import type { FarmAccess } from '../farms/access.js';
import { findFarmById } from '../farms/repository.js';
import { insertNote, listNotes } from './repository.js';

type Actor = { user: AuthUser; requestId: string };
type IdempotencyInput = { key: string | null; method: string; path: string };

export async function getYard(farmId: string) {
  const farm = await findFarmById(pool, farmId, false);
  if (!farm) throw new AppError(404, 'NOT_FOUND', 'Not found.');
  return { notes: await listNotes(pool, farmId), today: todayInTimeZone(farm.timezone) };
}

export async function createYardNote(actor: Actor, access: FarmAccess, body: unknown, idempotency: IdempotencyInput) {
  const input = yardNoteSchema.parse(body);
  const farm = await findFarmById(pool, access.farmId, false);
  if (!farm) throw new AppError(404, 'NOT_FOUND', 'Not found.');
  if (input.notedOn > todayInTimeZone(farm.timezone)) {
    throw new AppError(422, 'VALIDATION_ERROR', 'That date is in the future.', { fields: { notedOn: 'future_date' } });
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
    const id = await insertNote(conn, {
      farmId: access.farmId,
      notedOn: input.notedOn,
      kind: input.kind,
      notedTime: input.notedTime === '' ? null : `${input.notedTime}:00`,
      body: input.body,
      createdBy: actor.user.id,
    });
    await writeAudit(conn, {
      farmId: access.farmId,
      actorUserId: actor.user.id,
      action: 'yard.recorded',
      entityType: 'yard_note',
      entityId: id,
      requestId: actor.requestId,
      summary: { kind: input.kind },
    });
    const data = (await listNotes(conn, access.farmId)).find((item) => item.id === id);
    if (!data) throw new Error('Yard note insert failed.');
    if (reserved.mode === 'new') await finishIdempotency(conn, reserved.id, 201, data);
    return { mode: 'created' as const, status: 201, data };
  });
}
