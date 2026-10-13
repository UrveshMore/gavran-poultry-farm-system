import {
  attendanceInputSchema,
  taskTrainingRequirementSchema,
  trainingAssignmentInputSchema,
  trainingCompletionSchema,
  trainingItemInputSchema,
} from '@gavran/shared';
import { isDup } from '../../db/sql.js';
import { pool } from '../../db/pool.js';
import { withTransaction } from '../../db/transaction.js';
import { AppError } from '../../http/errors.js';
import { finishIdempotency, requestPath, reserveIdempotency } from '../../http/idempotency.js';
import { writeAudit } from '../audit/repository.js';
import type { AuthUser } from '../auth/types.js';
import { todayInTimeZone } from '../batches/service.js';
import { findActiveMember } from '../tasks/repository.js';
import type { FarmAccess } from '../farms/access.js';
import { findFarmById } from '../farms/repository.js';
import {
  actorMissingTraining,
  findAssignment,
  insertAssignment,
  insertAttendance,
  insertCompletion,
  insertItem,
  insertRequirement,
  itemOnFarm,
  listAssignments,
  listAttendance,
  listItems,
  listRequirements,
  taskOnFarm,
} from './repository.js';

type Actor = { user: AuthUser; requestId: string };
type IdempotencyInput = { key: string | null; method: string; path: string };

function seesAll(access: FarmAccess): boolean {
  return access.role === 'owner' || access.role === 'manager';
}

function canRecordOthers(access: FarmAccess): boolean {
  return access.role === 'owner' || access.role === 'manager';
}

export async function getAttendanceFor(access: FarmAccess, userId: string) {
  const records = await listAttendance(pool, access.farmId, seesAll(access) ? null : userId);
  return { records, metric: { kind: 'row_count' as const, rowCount: records.length } };
}

export async function recordAttendance(actor: Actor, access: FarmAccess, body: unknown, idempotency: IdempotencyInput) {
  const input = attendanceInputSchema.parse(body);
  const farm = await findFarmById(pool, access.farmId, false);
  if (!farm) throw new AppError(404, 'NOT_FOUND', 'Not found.');
  if (input.attendedOn > todayInTimeZone(farm.timezone)) {
    throw new AppError(422, 'VALIDATION_ERROR', 'That date is in the future.', { fields: { attendedOn: 'too_big' } });
  }
  const target = input.userId === '' ? actor.user.id : input.userId;
  if (target !== actor.user.id && !canRecordOthers(access)) {
    throw new AppError(403, 'FORBIDDEN', 'You can add an attendance row only for yourself.');
  }
  if (!(await findActiveMember(pool, access.farmId, target))) {
    throw new AppError(422, 'VALIDATION_ERROR', 'Choose a person on this farm.', { fields: { userId: 'invalid_format' } });
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
    const id = await insertAttendance(conn, {
      farmId: access.farmId,
      userId: target,
      attendedOn: input.attendedOn,
      attendedTime: input.attendedTime === '' ? null : input.attendedTime,
      methodLabel: input.methodLabel,
      note: input.note,
      createdBy: actor.user.id,
    });
    await writeAudit(conn, {
      farmId: access.farmId,
      actorUserId: actor.user.id,
      action: 'attendance.recorded',
      entityType: 'attendance_record',
      entityId: id,
      requestId: actor.requestId,
      summary: { attendedOn: input.attendedOn },
    });
    const data = (await listAttendance(conn, access.farmId, null)).find((row) => row.id === id);
    if (!data) throw new Error('Attendance insert failed.');
    if (reserved.mode === 'new') await finishIdempotency(conn, reserved.id, 201, data);
    return { mode: 'created' as const, status: 201, data };
  });
}

export async function getTraining(access: FarmAccess, userId: string) {
  const mine = seesAll(access) ? null : userId;
  return {
    items: await listItems(pool, access.farmId),
    assignments: await listAssignments(pool, access.farmId, mine),
    requirements: await listRequirements(pool, access.farmId),
  };
}

export async function createItem(actor: Actor, access: FarmAccess, body: unknown, idempotency: IdempotencyInput) {
  const input = trainingItemInputSchema.parse(body);
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
        title: input.title,
        body: input.body,
        versionLabel: input.versionLabel,
        createdBy: actor.user.id,
      });
      await writeAudit(conn, {
        farmId: access.farmId,
        actorUserId: actor.user.id,
        action: 'training_item.created',
        entityType: 'training_item',
        entityId: id,
        requestId: actor.requestId,
        summary: { title: input.title, versionLabel: input.versionLabel },
      });
      const data = (await listItems(conn, access.farmId)).find((item) => item.id === id);
      if (!data) throw new Error('Training item insert failed.');
      if (reserved.mode === 'new') await finishIdempotency(conn, reserved.id, 201, data);
      return { mode: 'created' as const, status: 201, data };
    });
  } catch (error) {
    if (isDup(error)) throw new AppError(409, 'DUPLICATE_CODE', 'That title and version are already used.');
    throw error;
  }
}

export async function createAssignment(actor: Actor, access: FarmAccess, body: unknown, idempotency: IdempotencyInput) {
  const input = trainingAssignmentInputSchema.parse(body);
  if (!(await itemOnFarm(pool, access.farmId, input.itemId))) {
    throw new AppError(422, 'VALIDATION_ERROR', 'Choose a training item on this farm.', { fields: { itemId: 'invalid_format' } });
  }
  if (!(await findActiveMember(pool, access.farmId, input.userId))) {
    throw new AppError(422, 'VALIDATION_ERROR', 'Choose a person on this farm.', { fields: { userId: 'invalid_format' } });
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
      const id = await insertAssignment(conn, {
        farmId: access.farmId,
        itemId: input.itemId,
        userId: input.userId,
        dueOn: input.dueOn === '' ? null : input.dueOn,
        createdBy: actor.user.id,
      });
      await writeAudit(conn, {
        farmId: access.farmId,
        actorUserId: actor.user.id,
        action: 'training_assignment.created',
        entityType: 'training_assignment',
        entityId: id,
        requestId: actor.requestId,
        summary: { dueOn: input.dueOn === '' ? null : input.dueOn },
      });
      const data = (await listAssignments(conn, access.farmId, null)).find((row) => row.id === id);
      if (!data) throw new Error('Training assignment insert failed.');
      if (reserved.mode === 'new') await finishIdempotency(conn, reserved.id, 201, data);
      return { mode: 'created' as const, status: 201, data };
    });
  } catch (error) {
    if (isDup(error)) throw new AppError(409, 'DUPLICATE_CODE', 'That person already has this training item.');
    throw error;
  }
}

export async function completeAssignment(actor: Actor, access: FarmAccess, assignmentId: string, body: unknown, idempotency: IdempotencyInput) {
  const input = trainingCompletionSchema.parse(body);
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
      const assignment = await findAssignment(conn, access.farmId, assignmentId);
      if (!assignment || assignment.userId !== actor.user.id) throw new AppError(404, 'NOT_FOUND', 'Not found.');
      if (assignment.completed) throw new AppError(409, 'TRAINING_ALREADY_DONE', 'That assignment is already finished.');
      const id = await insertCompletion(conn, {
        farmId: access.farmId,
        assignmentId,
        note: input.note,
        completedBy: actor.user.id,
      });
      await writeAudit(conn, {
        farmId: access.farmId,
        actorUserId: actor.user.id,
        action: 'training.completed',
        entityType: 'training_completion',
        entityId: id,
        requestId: actor.requestId,
        summary: { assignmentId },
      });
      const data = (await listAssignments(conn, access.farmId, actor.user.id)).find((row) => row.id === assignmentId);
      if (!data) throw new Error('Training completion failed.');
      if (reserved.mode === 'new') await finishIdempotency(conn, reserved.id, 201, data);
      return { mode: 'created' as const, status: 201, data };
    });
  } catch (error) {
    if (isDup(error)) throw new AppError(409, 'TRAINING_ALREADY_DONE', 'That assignment is already finished.');
    throw error;
  }
}

export async function linkTaskTraining(actor: Actor, access: FarmAccess, taskId: string, body: unknown, idempotency: IdempotencyInput) {
  const input = taskTrainingRequirementSchema.parse(body);
  if (!(await taskOnFarm(pool, access.farmId, taskId))) throw new AppError(404, 'NOT_FOUND', 'Not found.');
  if (!(await itemOnFarm(pool, access.farmId, input.itemId))) {
    throw new AppError(422, 'VALIDATION_ERROR', 'Choose a training item on this farm.', { fields: { itemId: 'invalid_format' } });
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
      const id = await insertRequirement(conn, {
        farmId: access.farmId,
        taskId,
        itemId: input.itemId,
        createdBy: actor.user.id,
      });
      await writeAudit(conn, {
        farmId: access.farmId,
        actorUserId: actor.user.id,
        action: 'task_training.linked',
        entityType: 'task_training_requirement',
        entityId: id,
        requestId: actor.requestId,
        summary: { taskId, itemId: input.itemId },
      });
      const data = (await listRequirements(conn, access.farmId)).find((row) => row.id === id);
      if (!data) throw new Error('Training link insert failed.');
      if (reserved.mode === 'new') await finishIdempotency(conn, reserved.id, 201, data);
      return { mode: 'created' as const, status: 201, data };
    });
  } catch (error) {
    if (isDup(error)) throw new AppError(409, 'DUPLICATE_CODE', 'That task already asks for this training item.');
    throw error;
  }
}

export { actorMissingTraining };
