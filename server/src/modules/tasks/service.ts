import {
  taskCompleteSchema,
  taskInputSchema,
  taskStepInputSchema,
  taskStepStatusSchema,
  taskTemplateInputSchema,
  taskTemplateRenameSchema,
} from '@gavran/shared';
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
import { actorMissingTraining } from '../workforce/repository.js';
import {
  completeTask,
  findActiveMember,
  findTask,
  findTemplate,
  insertStep,
  insertTask,
  insertTemplate,
  listTasks,
  listTemplates,
  renameTemplate,
  setStepStatus,
  type FarmTask,
} from './repository.js';

type Actor = { user: AuthUser; requestId: string };
type IdempotencyInput = { key: string | null; method: string; path: string };

function seesAll(access: FarmAccess): boolean {
  return access.role === 'owner' || access.role === 'manager' || access.role === 'vet_advisor';
}

function assigneeFilter(access: FarmAccess, userId: string): string | null {
  return seesAll(access) ? null : userId;
}

function present(task: FarmTask, today: string) {
  return { ...task, overdue: task.status === 'open' && task.dueOn < today };
}

async function farmToday(farmId: string): Promise<string> {
  const farm = await findFarmById(pool, farmId, false);
  if (!farm) throw new AppError(404, 'NOT_FOUND', 'Not found.');
  return todayInTimeZone(farm.timezone);
}

export async function getTemplates(farmId: string) {
  return listTemplates(pool, farmId);
}

export async function createTemplate(actor: Actor, access: FarmAccess, body: unknown, idempotency: IdempotencyInput) {
  const input = taskTemplateInputSchema.parse(body);
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
      const id = await insertTemplate(conn, access.farmId, input.name, input.season === '' ? null : input.season, actor.user.id);
      await writeAudit(conn, {
        farmId: access.farmId,
        actorUserId: actor.user.id,
        action: 'task_template.created',
        entityType: 'task_template',
        entityId: id,
        requestId: actor.requestId,
        summary: { name: input.name, season: input.season === '' ? null : input.season, steps: 0 },
      });
      const data = (await listTemplates(conn, access.farmId)).find((item) => item.id === id);
      if (!data) throw new Error('Task template insert failed.');
      if (reserved.mode === 'new') await finishIdempotency(conn, reserved.id, 201, data);
      return { mode: 'created' as const, status: 201, data };
    });
  } catch (error) {
    if (isDup(error)) throw new AppError(409, 'DUPLICATE_CODE', 'That checklist name or season is already used.');
    throw error;
  }
}

export async function updateTemplate(actor: Actor, access: FarmAccess, templateId: string, body: unknown) {
  const input = taskTemplateRenameSchema.parse(body);
  try {
    return await withTransaction(async (conn) => {
      const updated = await renameTemplate(conn, access.farmId, templateId, input.name);
      if (!updated) throw new AppError(404, 'NOT_FOUND', 'Not found.');
      await writeAudit(conn, {
        farmId: access.farmId,
        actorUserId: actor.user.id,
        action: 'task_template.renamed',
        entityType: 'task_template',
        entityId: templateId,
        requestId: actor.requestId,
        summary: { name: input.name },
      });
      const data = (await listTemplates(conn, access.farmId)).find((item) => item.id === templateId);
      if (!data) throw new AppError(404, 'NOT_FOUND', 'Not found.');
      return data;
    });
  } catch (error) {
    if (isDup(error)) throw new AppError(409, 'DUPLICATE_CODE', 'That checklist name is already used.');
    throw error;
  }
}

export async function addStep(actor: Actor, access: FarmAccess, templateId: string, body: unknown, idempotency: IdempotencyInput) {
  const input = taskStepInputSchema.parse(body);
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
    if (!(await findTemplate(conn, access.farmId, templateId))) throw new AppError(404, 'NOT_FOUND', 'Not found.');
    await insertStep(conn, templateId, input.body);
    await writeAudit(conn, {
      farmId: access.farmId,
      actorUserId: actor.user.id,
      action: 'task_template.step_added',
      entityType: 'task_template',
      entityId: templateId,
      requestId: actor.requestId,
      summary: { body: input.body },
    });
    const data = (await listTemplates(conn, access.farmId)).find((item) => item.id === templateId);
    if (!data) throw new Error('Task step insert failed.');
    if (reserved.mode === 'new') await finishIdempotency(conn, reserved.id, 201, data);
    return { mode: 'created' as const, status: 201, data };
  });
}

export async function updateStep(actor: Actor, access: FarmAccess, templateId: string, stepId: string, body: unknown) {
  const input = taskStepStatusSchema.parse(body);
  return withTransaction(async (conn) => {
    const updated = await setStepStatus(conn, access.farmId, templateId, stepId, input.status);
    if (!updated) throw new AppError(404, 'NOT_FOUND', 'Not found.');
    await writeAudit(conn, {
      farmId: access.farmId,
      actorUserId: actor.user.id,
      action: 'task_template.step_updated',
      entityType: 'task_template',
      entityId: templateId,
      requestId: actor.requestId,
      summary: { stepId, status: input.status },
    });
    const data = (await listTemplates(conn, access.farmId)).find((item) => item.id === templateId);
    if (!data) throw new AppError(404, 'NOT_FOUND', 'Not found.');
    return data;
  });
}

export async function getTasks(access: FarmAccess, userId: string) {
  const today = await farmToday(access.farmId);
  const tasks = await listTasks(pool, access.farmId, assigneeFilter(access, userId));
  return tasks.map((task) => present(task, today));
}

export async function getTask(access: FarmAccess, userId: string, taskId: string) {
  const today = await farmToday(access.farmId);
  const task = await findTask(pool, access.farmId, taskId, assigneeFilter(access, userId));
  if (!task) throw new AppError(404, 'NOT_FOUND', 'Not found.');
  return present(task, today);
}

export async function createTask(actor: Actor, access: FarmAccess, body: unknown, idempotency: IdempotencyInput) {
  const input = taskInputSchema.parse(body);
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
    const templateId = input.templateId === '' ? null : input.templateId;
    if (templateId && !(await findTemplate(conn, access.farmId, templateId))) {
      throw new AppError(422, 'VALIDATION_ERROR', 'Choose a checklist on this farm.', { fields: { templateId: 'invalid_format' } });
    }
    const assigneeUserId = input.assigneeUserId === '' ? null : input.assigneeUserId;
    if (assigneeUserId && !(await findActiveMember(conn, access.farmId, assigneeUserId))) {
      throw new AppError(422, 'VALIDATION_ERROR', 'Choose an active person on this farm.', { fields: { assigneeUserId: 'invalid_format' } });
    }
    const id = await insertTask(conn, {
      farmId: access.farmId,
      templateId,
      title: input.title,
      instructions: input.instructions === '' ? null : input.instructions,
      dueOn: input.dueOn,
      assigneeUserId,
      proofRequired: input.proofRequired,
      createdBy: actor.user.id,
    });
    await writeAudit(conn, {
      farmId: access.farmId,
      actorUserId: actor.user.id,
      action: 'task.created',
      entityType: 'task',
      entityId: id,
      requestId: actor.requestId,
      summary: { title: input.title, dueOn: input.dueOn },
    });
    const farm = await findFarmById(conn, access.farmId, false);
    if (!farm) throw new AppError(404, 'NOT_FOUND', 'Not found.');
    const task = await findTask(conn, access.farmId, id, null);
    if (!task) throw new Error('Task insert failed.');
    const data = present(task, todayInTimeZone(farm.timezone));
    if (reserved.mode === 'new') await finishIdempotency(conn, reserved.id, 201, data);
    return { mode: 'created' as const, status: 201, data };
  });
}

export async function finishTask(actor: Actor, access: FarmAccess, taskId: string, body: unknown, idempotency: IdempotencyInput) {
  const input = taskCompleteSchema.parse(body);
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
    const visible = await findTask(conn, access.farmId, taskId, assigneeFilter(access, actor.user.id));
    if (!visible) throw new AppError(404, 'NOT_FOUND', 'Not found.');
    if (visible.status === 'done') throw new AppError(409, 'TASK_ALREADY_DONE', 'That task is already complete.');
    if (visible.proofRequired && input.note === '') {
      throw new AppError(422, 'VALIDATION_ERROR', 'This task asks for a note.', { fields: { note: 'required' } });
    }
    if (await actorMissingTraining(conn, access.farmId, taskId, actor.user.id)) {
      throw new AppError(409, 'TRAINING_REQUIRED', 'Finish the linked training before this task.');
    }
    const updated = await completeTask(conn, access.farmId, taskId, input.note === '' ? null : input.note, actor.user.id);
    if (!updated) throw new AppError(409, 'TASK_ALREADY_DONE', 'That task is already complete.');
    await writeAudit(conn, {
      farmId: access.farmId,
      actorUserId: actor.user.id,
      action: 'task.completed',
      entityType: 'task',
      entityId: taskId,
      requestId: actor.requestId,
      summary: { title: visible.title },
    });
    const farm = await findFarmById(conn, access.farmId, false);
    if (!farm) throw new AppError(404, 'NOT_FOUND', 'Not found.');
    const task = await findTask(conn, access.farmId, taskId, null);
    if (!task) throw new Error('Task complete failed.');
    const data = present(task, todayInTimeZone(farm.timezone));
    if (reserved.mode === 'new') await finishIdempotency(conn, reserved.id, 200, data);
    return { mode: 'created' as const, status: 200, data };
  });
}
