import { blankIntent, interpret, OWNER_CITE, resolveIntent, stripInventedCare, type Intent, type SaathiReply } from '@gavran/shared';
import type { RowDataPacket } from 'mysql2';
import { z } from 'zod';
import { one } from '../../db/sql.js';
import { pool } from '../../db/pool.js';
import { AppError } from '../../http/errors.js';
import { getDashboard } from '../dashboard/service.js';
import type { FarmAccess } from '../farms/access.js';
import type { AuthUser } from '../auth/types.js';
import { loadContext } from './context.js';
import { geminiJson, probeGemini } from './gemini.js';
import { decryptSecret, encryptSecret } from './secret.js';

const keySchema = z.object({ apiKey: z.string().trim().min(20).max(200) });
const textSchema = z.object({
  text: z.string().trim().min(1).max(500),
  pending: z.unknown().optional(),
});

const modelSchema = {
  type: 'object',
  properties: {
    kind: { type: 'string' },
    confidence: { type: 'number' },
    count: { type: 'number' },
    amount: { type: 'number' },
    batchCode: { type: 'string' },
    date: { type: 'string' },
    title: { type: 'string' },
    section: { type: 'string' },
    reply: { type: 'string' },
  },
  required: ['kind', 'confidence'],
};

type Actor = { user: AuthUser; requestId: string };

export async function readKey(farmId: string): Promise<{ configured: boolean; hint: string }> {
  const row = await one<RowDataPacket & { hint: string }>(pool, 'SELECT hint FROM farm_ai_keys WHERE farm_id = ?', [farmId]);
  return { configured: Boolean(row), hint: row?.hint ?? '' };
}

export async function saveKey(access: FarmAccess, userId: string, body: unknown) {
  const input = keySchema.parse(body);
  const tested = process.env.NODE_ENV !== 'test';
  if (tested) {
    const ok = await probeGemini(input.apiKey);
    if (!ok) throw new AppError(422, 'SAATHI_KEY_INVALID', 'That key did not work. Check it and try again.');
  }
  const sealed = encryptSecret(input.apiKey);
  await pool.query(
    `INSERT INTO farm_ai_keys (farm_id, cipher_text, nonce, auth_tag, hint, updated_by)
     VALUES (?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE cipher_text = VALUES(cipher_text), nonce = VALUES(nonce), auth_tag = VALUES(auth_tag), hint = VALUES(hint), updated_by = VALUES(updated_by)`,
    [access.farmId, sealed.cipherText, sealed.nonce, sealed.authTag, sealed.hint, userId],
  );
  return { configured: true, hint: sealed.hint, tested };
}

export async function clearKey(farmId: string) {
  await pool.query('DELETE FROM farm_ai_keys WHERE farm_id = ?', [farmId]);
  return { configured: false, hint: '' };
}

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

function asIntent(value: unknown): Intent | null {
  if (!value || typeof value !== 'object') return null;
  const row = value as Partial<Intent>;
  if (typeof row.kind !== 'string' || typeof row.note !== 'string') return null;
  return row as Intent;
}

/** Draft only. This does not insert eggs, losses, doses, jobs, feed, sales, or expenses. */
export async function propose(actor: Actor, access: FarmAccess, body: unknown): Promise<SaathiReply> {
  const input = textSchema.parse(body);
  const ctx = await loadContext(access);
  let reply = interpret(input.text, asIntent(input.pending), ctx);
  if (reply.type === 'ask' && reply.speechKey === 'saathi.ask.unclear') {
    const apiKey = await storedKey(access.farmId);
    if (apiKey) {
      const model = await geminiJson(
        apiKey,
        [{ text: `Farm today is ${ctx.today}. Flocks: ${ctx.batches.map((row) => row.code).join(', ') || 'none'}. Return JSON for the utterance. Do not invent a dose. Utterance: ${input.text}` }],
        modelSchema,
      );
      const cleaned = stripInventedCare(model);
      if (cleaned && typeof cleaned === 'object') {
        const row = cleaned as Record<string, unknown>;
        const kind = String(row.kind ?? '');
        const confidence = Number(row.confidence);
        if (kind === 'chat' && confidence >= 0.6) {
          const text = typeof row.reply === 'string' ? row.reply.trim().slice(0, 500) : '';
          return text
            ? { type: 'answer', speechKey: 'saathi.say.model', vars: { text } }
            : { type: 'answer', speechKey: 'saathi.say.hello', vars: {} };
        }
        const known = ['eggs', 'loss', 'hatch', 'dose', 'task', 'feed', 'sale', 'expense', 'ask_doses', 'ask_counts', 'ask_eggs', 'ask_stock', 'ask_vaccines', 'help'];
        if (known.includes(kind) && confidence >= 0.6) {
          const intent = blankIntent(input.text);
          intent.kind = kind as Intent['kind'];
          intent.confidence = confidence;
          intent.count = typeof row.count === 'number' ? row.count : null;
          intent.amount = typeof row.amount === 'number' ? row.amount : null;
          intent.batchCode = row.batchCode ? String(row.batchCode) : null;
          intent.date = row.date ? String(row.date) : null;
          intent.title = row.title ? String(row.title) : '';
          intent.section = row.section ? String(row.section) : null;
          reply = resolveIntent(intent, ctx);
        }
      }
    }
  }
  if (reply.type !== 'lookup') return reply;
  return answerLookup(actor, access, reply.lookup);
}

async function answerLookup(actor: Actor, access: FarmAccess, lookup: 'doses' | 'counts' | 'eggs' | 'stock' | 'vaccines'): Promise<SaathiReply> {
  const board = await getDashboard(access, actor.user.id);
  if (lookup === 'counts') {
    if (!board.birds) return { type: 'denied', speechKey: 'saathi.denied', vars: {} };
    return {
      type: 'answer',
      speechKey: 'saathi.say.counts',
      vars: {
        total: String(board.birds.total),
        roosters: board.birds.roosters === null ? '—' : String(board.birds.roosters),
        hens: board.birds.hens === null ? '—' : String(board.birds.hens),
      },
    };
  }
  if (lookup === 'eggs') {
    if (!board.eggs) return { type: 'denied', speechKey: 'saathi.denied', vars: {} };
    return { type: 'answer', speechKey: 'saathi.say.eggsToday', vars: { count: String(board.eggs.today) } };
  }
  if (lookup === 'stock') {
    if (!board.stock) return { type: 'denied', speechKey: 'saathi.denied', vars: {} };
    const lines = board.stock.low.map((item) => `${item.name} ${item.onHand} ${item.unitLabel}`);
    return { type: 'answer', speechKey: lines.length ? 'saathi.say.stock' : 'saathi.say.none', vars: { list: lines.join('. ') } };
  }
  if (lookup === 'doses') {
    if (!board.doses) return { type: 'denied', speechKey: 'saathi.denied', vars: {} };
    const lines = board.doses.groups.flatMap((group) =>
      group.lines
        .filter((line) => !line.given)
        .map((line) => `${group.batchCode} ${line.slot} ${line.itemName}${line.origin === 'owner' ? ` ${OWNER_CITE}` : ''}`),
    );
    return { type: 'answer', speechKey: lines.length ? 'saathi.say.doses' : 'saathi.say.noDoses', vars: { list: lines.join('. ') } };
  }
  const due = [...(board.health?.vaccines.overdue ?? []), ...(board.health?.vaccines.dueToday ?? [])];
  return { type: 'answer', speechKey: due.length ? 'saathi.say.vaccines' : 'saathi.say.noDoses', vars: { list: due.map((row) => row.title).join('. ') } };
}

export async function transcribe(access: FarmAccess, file: { buffer: Buffer; mimetype: string } | undefined, pending: unknown, actor: Actor) {
  if (!file || file.buffer.length === 0) throw new AppError(422, 'VALIDATION_ERROR', 'Choose a recording.', { fields: { file: 'required' } });
  const apiKey = await storedKey(access.farmId);
  if (!apiKey) throw new AppError(422, 'SAATHI_KEY_MISSING', 'Add the Gemini key in farm details.');
  const model = await geminiJson(
    apiKey,
    [
      { text: 'Write the spoken words only, as JSON {"text":"..."} . Do not add a dose.' },
      { inline_data: { mime_type: file.mimetype || 'audio/webm', data: file.buffer.toString('base64') } },
    ],
    { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] },
  );
  const text = model && typeof model === 'object' && 'text' in model ? String((model as { text: unknown }).text ?? '').trim() : '';
  if (!text) throw new AppError(422, 'SAATHI_UNCLEAR', 'The recording was not clear.');
  return propose(actor, access, { text, pending });
}
