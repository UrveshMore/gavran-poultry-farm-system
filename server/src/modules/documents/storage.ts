import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(fileURLToPath(new URL('../../../../uploads', import.meta.url)));

const kinds = {
  'image/jpeg': { ext: 'jpg', magic: (bytes: Buffer) => bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 },
  'image/png': { ext: 'png', magic: (bytes: Buffer) => bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  'image/webp': { ext: 'webp', magic: (bytes: Buffer) => bytes.subarray(0, 4).toString('ascii') === 'RIFF' && bytes.subarray(8, 12).toString('ascii') === 'WEBP' },
  'application/pdf': { ext: 'pdf', magic: (bytes: Buffer) => bytes.subarray(0, 5).toString('ascii') === '%PDF-' },
} as const;

export type StoredKind = keyof typeof kinds;

export function detectKind(bytes: Buffer): StoredKind | null {
  for (const [kind, rule] of Object.entries(kinds) as Array<[StoredKind, (typeof kinds)[StoredKind]]>) {
    if (rule.magic(bytes)) return kind;
  }
  return null;
}

export function safeOriginalName(name: string): string {
  const base = path.basename(name).replace(/[^\w.\- ]+/g, '').trim();
  return (base || 'file').slice(0, 160);
}

export async function saveFarmFile(farmId: string, bytes: Buffer, kind: StoredKind): Promise<string> {
  const stored = `${randomUUID()}.${kinds[kind].ext}`;
  const dir = path.join(root, farmId);
  await mkdir(dir, { recursive: true });
  const target = path.join(dir, stored);
  if (!target.startsWith(dir + path.sep)) throw new Error('Refused path.');
  await writeFile(target, bytes);
  return stored;
}

export async function readFarmFile(farmId: string, storedName: string): Promise<Buffer> {
  if (!/^[\w.-]+$/.test(storedName)) throw new Error('Refused path.');
  const target = path.join(root, farmId, storedName);
  const dir = path.join(root, farmId);
  if (!target.startsWith(dir + path.sep)) throw new Error('Refused path.');
  return readFile(target);
}
