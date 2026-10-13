import { z } from 'zod';
import { pool } from '../../db/pool.js';
import { withTransaction } from '../../db/transaction.js';
import { AppError } from '../../http/errors.js';
import { finishIdempotency, requestPath, reserveIdempotency } from '../../http/idempotency.js';
import { writeAudit } from '../audit/repository.js';
import type { AuthUser } from '../auth/types.js';
import type { FarmAccess } from '../farms/access.js';
import { findFile, insertFile, listFiles } from './repository.js';
import { detectKind, readFarmFile, safeOriginalName, saveFarmFile } from './storage.js';

const noteSchema = z.object({ note: z.string().trim().max(500, 'too_big').optional().default('') });
type Actor = { user: AuthUser; requestId: string };
type IdempotencyInput = { key: string | null; method: string; path: string };

export async function getDocuments(farmId: string) {
  return {
    files: await listFiles(pool, farmId),
    scan: { status: 'not_claimed' as const },
    retention: { status: 'not_chosen' as const, reason: 'decision 15 is open' },
  };
}

export async function storeDocument(
  actor: Actor,
  access: FarmAccess,
  file: { originalname: string; buffer: Buffer } | undefined,
  body: unknown,
  idempotency: IdempotencyInput,
) {
  if (!file || file.buffer.length === 0) {
    throw new AppError(422, 'VALIDATION_ERROR', 'Choose a file.', { fields: { file: 'required' } });
  }
  const kind = detectKind(file.buffer);
  if (!kind) throw new AppError(422, 'VALIDATION_ERROR', 'Use a JPEG, PNG, WebP, or PDF.', { fields: { file: 'invalid_format' } });
  const note = noteSchema.parse(body).note;
  const path = requestPath(idempotency.path);
  return withTransaction(async (conn) => {
    const reserved = await reserveIdempotency(conn, { userId: actor.user.id, farmId: access.farmId, key: idempotency.key, method: idempotency.method, path });
    if (reserved.mode === 'replay') return reserved;
    const storedName = await saveFarmFile(access.farmId, file.buffer, kind);
    const id = await insertFile(conn, {
      farmId: access.farmId,
      originalName: safeOriginalName(file.originalname),
      storedName,
      mediaType: kind,
      byteSize: file.buffer.length,
      note,
      createdBy: actor.user.id,
    });
    await writeAudit(conn, { farmId: access.farmId, actorUserId: actor.user.id, action: 'document.stored', entityType: 'farm_file', entityId: id, requestId: actor.requestId, summary: { mediaType: kind, byteSize: file.buffer.length } });
    const data = (await listFiles(conn, access.farmId)).find((row) => row.id === id);
    if (!data) throw new Error('File insert failed.');
    if (reserved.mode === 'new') await finishIdempotency(conn, reserved.id, 201, data);
    return { mode: 'created' as const, status: 201, data };
  });
}

export async function openDocument(farmId: string, fileId: string) {
  const file = await findFile(pool, farmId, fileId);
  if (!file) throw new AppError(404, 'NOT_FOUND', 'Not found.');
  const bytes = await readFarmFile(farmId, file.storedName);
  return { file, bytes };
}
