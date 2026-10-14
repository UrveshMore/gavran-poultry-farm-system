import { randomUUID } from 'node:crypto';
import { matchKnowledge, parsePhotoAi, type KbEntry, type PhotoAi } from '@gavran/shared';
import type { RowDataPacket } from 'mysql2';
import { z } from 'zod';
import { many, one } from '../../db/sql.js';
import { pool } from '../../db/pool.js';
import { AppError } from '../../http/errors.js';
import { writeAudit } from '../audit/repository.js';
import type { AuthUser } from '../auth/types.js';
import { detectKind, saveFarmFile } from '../documents/storage.js';
import { loadCareEntries } from '../medicines/service.js';
import { geminiJson } from './gemini.js';
import { decryptSecret } from './secret.js';

const kindSchema = z.enum(['eggs', 'chicks', 'bird', 'sick']);
const correctionSchema = z.object({
  count: z.number().int().min(0).max(100_000).nullable().optional(),
  note: z.string().trim().max(500).optional(),
});

const photoSchema = {
  type: 'object',
  properties: {
    count: { type: 'number' },
    confidence: { type: 'number' },
    boxes: { type: 'array', items: { type: 'object', properties: { x: { type: 'number' }, y: { type: 'number' }, w: { type: 'number' }, h: { type: 'number' } } } },
    ageRange: { type: 'string' },
    signs: { type: 'array', items: { type: 'string' } },
  },
  required: ['confidence', 'signs'],
};

type Actor = { user: AuthUser; requestId: string };

async function storedKey(farmId: string): Promise<string | null> {
  const row = await one<RowDataPacket & { cipher_text: string; nonce: string; auth_tag: string }>(
    pool,
    'SELECT cipher_text, nonce, auth_tag FROM farm_ai_keys WHERE farm_id = ?',
    [farmId],
  );
  if (!row) return null;
  try {
    return decryptSecret(row.cipher_text, row.nonce, row.auth_tag);
  } catch {
    return null;
  }
}

function emptyAi(): PhotoAi {
  return { count: null, confidence: 0, boxes: [], ageRange: null, signs: [], unavailable: true };
}

export async function readPhoto(farmId: string, photoId: string, file: { buffer: Buffer; mimetype: string } | undefined, actor: Actor) {
  const kind = kindSchema.parse(photoId);
  if (!file || file.buffer.length === 0) throw new AppError(422, 'VALIDATION_ERROR', 'Choose a photo.', { fields: { file: 'required' } });
  const media = detectKind(file.buffer);
  if (!media || media === 'application/pdf') throw new AppError(422, 'VALIDATION_ERROR', 'Use a JPEG, PNG, or WebP.', { fields: { file: 'invalid_format' } });
  const apiKey = await storedKey(farmId);
  let ai = emptyAi();
  if (apiKey) {
    const prompt =
      kind === 'sick' || kind === 'bird'
        ? 'Describe visible signs only. Do not name a medicine or a dose. ageRange is a guess, not a hatch date. confidence is 0 to 1.'
        : 'Count the animals or eggs. boxes are fractions of width and height from the top left. Do not name a medicine or a dose. If unsure, set confidence below 0.6.';
    const model = await geminiJson(apiKey, [
      { text: prompt },
      { inline_data: { mime_type: media, data: file.buffer.toString('base64') } },
    ], photoSchema);
    ai = parsePhotoAi(model) ?? emptyAi();
    if ((ai.confidence ?? 0) < 0.6) ai = { ...ai, count: ai.count };
  }
  const papers = await many<RowDataPacket & KbEntry>(
    pool,
    `SELECT id, title, source_file AS sourceFile, source_page AS sourcePage,
            COALESCE(symptoms, '') AS symptoms, COALESCE(used_for, '') AS usedFor,
            COALESCE(how_to_give, '') AS howToGive, COALESCE(schedule_text, '') AS scheduleText
     FROM knowledge_entries WHERE kind IN ('disease', 'medicine', 'care')`,
  );
  const entries = [...papers, ...(await loadCareEntries(farmId))];
  const matches = kind === 'sick' || kind === 'bird' ? matchKnowledge(ai.signs.join(' '), entries) : [];
  const id = randomUUID();
  const storedName = await saveFarmFile(farmId, file.buffer, media);
  await pool.query(
    `INSERT INTO saathi_photos (id, farm_id, user_id, kind, stored_name, ai_json) VALUES (?, ?, ?, ?, ?, ?)`,
    [id, farmId, actor.user.id, kind, storedName, JSON.stringify(ai)],
  );
  await writeAudit(pool, {
    farmId,
    actorUserId: actor.user.id,
    action: 'saathi.photo',
    entityType: 'saathi_photo',
    entityId: id,
    requestId: actor.requestId,
    summary: { kind, confidence: ai.confidence, counted: ai.count },
  });
  return { id, kind, ai, matches, saved: false as const };
}

export async function correctPhoto(farmId: string, photoId: string, body: unknown, actor: Actor) {
  const input = correctionSchema.parse(body);
  const existing = await one<RowDataPacket & { id: string }>(pool, 'SELECT id FROM saathi_photos WHERE farm_id = ? AND id = ?', [farmId, photoId]);
  if (!existing) throw new AppError(404, 'NOT_FOUND', 'Not found.');
  await pool.query('UPDATE saathi_photos SET correction_json = ? WHERE id = ?', [JSON.stringify(input), photoId]);
  await writeAudit(pool, {
    farmId,
    actorUserId: actor.user.id,
    action: 'saathi.corrected',
    entityType: 'saathi_photo',
    entityId: photoId,
    requestId: actor.requestId,
    summary: { count: input.count ?? null },
  });
  return { id: photoId, correction: input, saved: false as const };
}
