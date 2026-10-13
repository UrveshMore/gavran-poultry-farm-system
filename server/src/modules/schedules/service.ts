import { reportRunSchema, reportScheduleInputSchema } from '@gavran/shared';
import { pool } from '../../db/pool.js';
import { withTransaction } from '../../db/transaction.js';
import { AppError } from '../../http/errors.js';
import { finishIdempotency, requestPath, reserveIdempotency } from '../../http/idempotency.js';
import { writeAudit } from '../audit/repository.js';
import type { AuthUser } from '../auth/types.js';
import type { FarmAccess } from '../farms/access.js';
import { buildReport } from '../reports/service.js';
import { findSchedule, insertSchedule, listSchedules } from './repository.js';

type Actor = { user: AuthUser; requestId: string };
type IdempotencyInput = { key: string | null; method: string; path: string };

const held = {
  delivery: 'not_sent' as const,
  cadence: { status: 'not_chosen' as const, reason: 'no clock was chosen' },
};

export async function getSchedules(farmId: string) {
  return { schedules: await listSchedules(pool, farmId), ...held };
}

export async function createSchedule(actor: Actor, access: FarmAccess, body: unknown, idempotency: IdempotencyInput) {
  const input = reportScheduleInputSchema.parse(body);
  const path = requestPath(idempotency.path);
  return withTransaction(async (conn) => {
    const reserved = await reserveIdempotency(conn, { userId: actor.user.id, farmId: access.farmId, key: idempotency.key, method: idempotency.method, path });
    if (reserved.mode === 'replay') return reserved;
    const id = await insertSchedule(conn, { farmId: access.farmId, name: input.name, note: input.note, namedOn: input.namedOn, createdBy: actor.user.id });
    await writeAudit(conn, { farmId: access.farmId, actorUserId: actor.user.id, action: 'report_schedule.created', entityType: 'report_schedule', entityId: id, requestId: actor.requestId, summary: { name: input.name } });
    const data = await findSchedule(conn, access.farmId, id);
    if (!data) throw new Error('Schedule insert failed.');
    if (reserved.mode === 'new') await finishIdempotency(conn, reserved.id, 201, data);
    return { mode: 'created' as const, status: 201, data };
  });
}

export async function runSchedule(actor: Actor, access: FarmAccess, scheduleId: string, body: unknown) {
  const input = reportRunSchema.parse(body);
  const schedule = await findSchedule(pool, access.farmId, scheduleId);
  if (!schedule) throw new AppError(404, 'NOT_FOUND', 'Not found.');
  const report = await buildReport(access.farmId, { from: input.from, to: input.to });
  await withTransaction(async (conn) => {
    await writeAudit(conn, {
      farmId: access.farmId,
      actorUserId: actor.user.id,
      action: 'report_schedule.run',
      entityType: 'report_schedule',
      entityId: schedule.id,
      requestId: actor.requestId,
      summary: { from: input.from, to: input.to },
    });
  });
  return { schedule, ...held, report };
}
