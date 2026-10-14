import {
  biosecurityStepSchema,
  healthObservationSchema,
  knowledgeApprovalSchema,
  medicineRecordSchema,
  vaccineTaskSchema,
} from '@gavran/shared';
import { pool } from '../../db/pool.js';
import { withTransaction } from '../../db/transaction.js';
import { AppError } from '../../http/errors.js';
import { finishIdempotency, requestPath, reserveIdempotency } from '../../http/idempotency.js';
import { writeAudit } from '../audit/repository.js';
import type { AuthUser } from '../auth/types.js';
import { todayInTimeZone } from '../batches/service.js';
import type { FarmAccess } from '../farms/access.js';
import { findFarmById } from '../farms/repository.js';
import { findActiveMember, insertTask } from '../tasks/repository.js';
import {
  STEP_FILE,
  approveBiosecurity,
  findEntry,
  findEntryByPage,
  insertBiosecurity,
  insertMedicine,
  insertObservation,
  listBiosecurity,
  listEntries,
  listMedicines,
  listObservations,
  saveApproval,
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

export async function getEntries(farmId: string) {
  return listEntries(pool, farmId);
}

export async function setApproval(actor: Actor, access: FarmAccess, entryId: string, body: unknown) {
  const input = knowledgeApprovalSchema.parse(body);
  return withTransaction(async (conn) => {
    const entry = await findEntry(conn, access.farmId, entryId);
    if (!entry) throw new AppError(404, 'NOT_FOUND', 'Not found.');
    await saveApproval(conn, {
      farmId: access.farmId,
      entryId,
      approved: input.approved,
      verificationNote: input.verificationNote === '' ? null : input.verificationNote,
      userId: actor.user.id,
    });
    await writeAudit(conn, {
      farmId: access.farmId,
      actorUserId: actor.user.id,
      action: 'knowledge.approval_set',
      entityType: 'knowledge_entry',
      entityId: entryId,
      requestId: actor.requestId,
      summary: { approved: input.approved, sourceFile: entry.sourceFile, sourcePage: entry.sourcePage },
    });
    const saved = await findEntry(conn, access.farmId, entryId);
    if (!saved) throw new Error('Approval save failed.');
    return saved;
  });
}

export async function getObservations(farmId: string) {
  return listObservations(pool, farmId);
}

export async function createObservation(actor: Actor, access: FarmAccess, body: unknown, idempotency: IdempotencyInput) {
  const input = healthObservationSchema.parse(body);
  const today = await farmToday(access.farmId);
  if (input.observedOn > today) {
    throw new AppError(422, 'VALIDATION_ERROR', 'That date is in the future.', { fields: { observedOn: 'future_date' } });
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
    const entryId = blank(input.entryId);
    if (entryId && !(await findEntry(conn, access.farmId, entryId))) {
      throw new AppError(422, 'VALIDATION_ERROR', 'Choose a page from the knowledge base.', { fields: { entryId: 'invalid_format' } });
    }
    if (input.batchId) {
      const { findBatch } = await import('../stock/repository.js');
      if (!(await findBatch(conn, access.farmId, input.batchId))) {
        throw new AppError(422, 'VALIDATION_ERROR', 'Choose a batch on this farm.', { fields: { batchId: 'invalid_format' } });
      }
    }
    const id = await insertObservation(conn, {
      farmId: access.farmId,
      observedOn: input.observedOn,
      batchId: blank(input.batchId),
      birdCount: input.birdCount,
      notes: input.notes,
      entryId,
      createdBy: actor.user.id,
    });
    await writeAudit(conn, {
      farmId: access.farmId,
      actorUserId: actor.user.id,
      action: 'health.observed',
      entityType: 'health_observation',
      entityId: id,
      requestId: actor.requestId,
      summary: { observedOn: input.observedOn },
    });
    const data = (await listObservations(conn, access.farmId)).find((item) => item.id === id);
    if (!data) throw new Error('Observation insert failed.');
    if (reserved.mode === 'new') await finishIdempotency(conn, reserved.id, 201, data);
    return { mode: 'created' as const, status: 201, data };
  });
}

export async function getMedicines(farmId: string) {
  return listMedicines(pool, farmId);
}

export async function createMedicine(actor: Actor, access: FarmAccess, body: unknown, idempotency: IdempotencyInput) {
  const input = medicineRecordSchema.parse(body);
  const today = await farmToday(access.farmId);
  if (input.givenOn > today) {
    throw new AppError(422, 'VALIDATION_ERROR', 'That date is in the future.', { fields: { givenOn: 'future_date' } });
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
    const entry = await findEntry(conn, access.farmId, input.entryId);
    if (!entry) throw new AppError(422, 'VALIDATION_ERROR', 'Choose a page from the knowledge base.', { fields: { entryId: 'invalid_format' } });
    if (!entry.approved || !entry.verificationNote) {
      throw new AppError(409, 'ENTRY_UNAPPROVED', 'That page is not approved for use.');
    }
    if (input.batchId) {
      const { findBatch } = await import('../stock/repository.js');
      if (!(await findBatch(conn, access.farmId, input.batchId))) {
        throw new AppError(422, 'VALIDATION_ERROR', 'Choose a batch on this farm.', { fields: { batchId: 'invalid_format' } });
      }
    }
    const id = await insertMedicine(conn, {
      farmId: access.farmId,
      entryId: input.entryId,
      givenOn: input.givenOn,
      batchId: blank(input.batchId),
      notes: input.notes,
      createdBy: actor.user.id,
    });
    await writeAudit(conn, {
      farmId: access.farmId,
      actorUserId: actor.user.id,
      action: 'health.medicine_recorded',
      entityType: 'medicine_record',
      entityId: id,
      requestId: actor.requestId,
      summary: { sourceFile: entry.sourceFile, sourcePage: entry.sourcePage },
    });
    const data = (await listMedicines(conn, access.farmId)).find((item) => item.id === id);
    if (!data) throw new Error('Medicine insert failed.');
    if (reserved.mode === 'new') await finishIdempotency(conn, reserved.id, 201, data);
    return { mode: 'created' as const, status: 201, data };
  });
}

export async function createVaccineTask(actor: Actor, access: FarmAccess, entryId: string, body: unknown, idempotency: IdempotencyInput) {
  const input = vaccineTaskSchema.parse(body);
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
    const entry = await findEntry(conn, access.farmId, entryId);
    if (!entry) throw new AppError(404, 'NOT_FOUND', 'Not found.');
    if (!entry.approved || !entry.verificationNote) {
      throw new AppError(409, 'ENTRY_UNAPPROVED', 'That page is not approved for use.');
    }
    const assignee = blank(input.assigneeUserId);
    if (assignee && !(await findActiveMember(conn, access.farmId, assignee))) {
      throw new AppError(422, 'VALIDATION_ERROR', 'Choose an active person on this farm.', { fields: { assigneeUserId: 'invalid_format' } });
    }
    const taskId = await insertTask(conn, {
      farmId: access.farmId,
      templateId: null,
      title: entry.title.slice(0, 160),
      instructions: entry.verificationNote,
      dueOn: input.dueOn,
      assigneeUserId: assignee,
      proofRequired: false,
      createdBy: actor.user.id,
    });
    await writeAudit(conn, {
      farmId: access.farmId,
      actorUserId: actor.user.id,
      action: 'health.vaccine_task_created',
      entityType: 'task',
      entityId: taskId,
      requestId: actor.requestId,
      summary: { sourceFile: entry.sourceFile, sourcePage: entry.sourcePage },
    });
    const data = { taskId, title: entry.title.slice(0, 160), sourceFile: entry.sourceFile, sourcePage: entry.sourcePage };
    if (reserved.mode === 'new') await finishIdempotency(conn, reserved.id, 201, data);
    return { mode: 'created' as const, status: 201, data };
  });
}

export async function getBiosecurity(farmId: string) {
  return listBiosecurity(pool, farmId);
}

export async function createBiosecurity(actor: Actor, access: FarmAccess, body: unknown, idempotency: IdempotencyInput) {
  const input = biosecurityStepSchema.parse(body);
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
    let storedBody = input.body;
    let sourceFile: string | null = null;
    let sourcePage: number | null = null;
    let approved = false;
    if (input.origin === 'pdf') {
      if (input.sourceFile !== STEP_FILE || input.sourcePage === null) {
        throw new AppError(422, 'VALIDATION_ERROR', 'Biosecurity text can be copied only from the step-by-step PDF.', {
          fields: { sourceFile: 'invalid_format' },
        });
      }
      const entry = await findEntryByPage(conn, STEP_FILE, input.sourcePage);
      if (!entry) throw new AppError(422, 'VALIDATION_ERROR', 'That page is not in the step-by-step PDF.', { fields: { sourcePage: 'invalid_format' } });
      storedBody = entry.textLayer.replace(/\s+/g, ' ').trim().slice(0, 1000);
      if (storedBody.length === 0) {
        throw new AppError(422, 'VALIDATION_ERROR', 'That page has no text layer to copy.', { fields: { sourcePage: 'invalid_format' } });
      }
      sourceFile = STEP_FILE;
      sourcePage = input.sourcePage;
      approved = false;
    } else {
      approved = true;
    }
    const id = await insertBiosecurity(conn, {
      farmId: access.farmId,
      body: storedBody,
      origin: input.origin,
      sourceFile,
      sourcePage,
      approved,
      createdBy: actor.user.id,
    });
    await writeAudit(conn, {
      farmId: access.farmId,
      actorUserId: actor.user.id,
      action: 'biosecurity.step_added',
      entityType: 'biosecurity_step',
      entityId: id,
      requestId: actor.requestId,
      summary: { origin: input.origin, sourcePage },
    });
    const data = (await listBiosecurity(conn, access.farmId)).find((item) => item.id === id);
    if (!data) throw new Error('Biosecurity insert failed.');
    if (reserved.mode === 'new') await finishIdempotency(conn, reserved.id, 201, data);
    return { mode: 'created' as const, status: 201, data };
  });
}

export async function acceptBiosecurity(actor: Actor, access: FarmAccess, stepId: string) {
  return withTransaction(async (conn) => {
    const updated = await approveBiosecurity(conn, access.farmId, stepId);
    if (!updated) throw new AppError(404, 'NOT_FOUND', 'Not found.');
    await writeAudit(conn, {
      farmId: access.farmId,
      actorUserId: actor.user.id,
      action: 'biosecurity.step_approved',
      entityType: 'biosecurity_step',
      entityId: stepId,
      requestId: actor.requestId,
      summary: {},
    });
    const data = (await listBiosecurity(conn, access.farmId)).find((item) => item.id === stepId);
    if (!data) throw new Error('Biosecurity approval failed.');
    return data;
  });
}
