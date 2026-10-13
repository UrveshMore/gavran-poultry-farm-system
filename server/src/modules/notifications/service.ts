import { notificationInputSchema } from '@gavran/shared';
import { pool } from '../../db/pool.js';
import { withTransaction } from '../../db/transaction.js';
import { AppError } from '../../http/errors.js';
import { finishIdempotency, requestPath, reserveIdempotency } from '../../http/idempotency.js';
import { writeAudit } from '../audit/repository.js';
import type { AuthUser } from '../auth/types.js';
import { findActiveMember } from '../tasks/repository.js';
import type { FarmAccess } from '../farms/access.js';
import { insertNotice, listNotices, markRead } from './repository.js';

type Actor = { user: AuthUser; requestId: string };
type IdempotencyInput = { key: string | null; method: string; path: string };

function seesAll(access: FarmAccess): boolean {
  return access.permissions.includes('notification.write');
}

export async function getNotices(access: FarmAccess, userId: string) {
  return {
    notices: await listNotices(pool, access.farmId, seesAll(access) ? null : userId),
    delivery: 'in_app' as const,
    urgent: { status: 'not_chosen' as const, reason: 'decision 14 is open' },
  };
}

export async function createNotice(actor: Actor, access: FarmAccess, body: unknown, idempotency: IdempotencyInput) {
  const input = notificationInputSchema.parse(body);
  if (!(await findActiveMember(pool, access.farmId, input.userId))) {
    throw new AppError(422, 'VALIDATION_ERROR', 'Choose a person on this farm.', { fields: { userId: 'invalid_format' } });
  }
  const path = requestPath(idempotency.path);
  return withTransaction(async (conn) => {
    const reserved = await reserveIdempotency(conn, { userId: actor.user.id, farmId: access.farmId, key: idempotency.key, method: idempotency.method, path });
    if (reserved.mode === 'replay') return reserved;
    const id = await insertNotice(conn, { farmId: access.farmId, userId: input.userId, title: input.title, body: input.body, createdBy: actor.user.id });
    await writeAudit(conn, { farmId: access.farmId, actorUserId: actor.user.id, action: 'notification.created', entityType: 'notification', entityId: id, requestId: actor.requestId, summary: { title: input.title } });
    const data = (await listNotices(conn, access.farmId, null)).find((row) => row.id === id);
    if (!data) throw new Error('Notice insert failed.');
    if (reserved.mode === 'new') await finishIdempotency(conn, reserved.id, 201, data);
    return { mode: 'created' as const, status: 201, data };
  });
}

export async function readNotice(actor: Actor, access: FarmAccess, noticeId: string) {
  return withTransaction(async (conn) => {
    const updated = await markRead(conn, access.farmId, noticeId, actor.user.id);
    if (!updated) throw new AppError(404, 'NOT_FOUND', 'Not found.');
    await writeAudit(conn, { farmId: access.farmId, actorUserId: actor.user.id, action: 'notification.read', entityType: 'notification', entityId: noticeId, requestId: actor.requestId, summary: {} });
    const data = (await listNotices(conn, access.farmId, actor.user.id)).find((row) => row.id === noticeId);
    if (!data) throw new Error('Notice read failed.');
    return data;
  });
}
