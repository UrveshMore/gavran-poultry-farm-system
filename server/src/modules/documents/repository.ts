import { randomUUID } from 'node:crypto';
import type { RowDataPacket } from 'mysql2/promise';
import { exec, many, one, type Db } from '../../db/sql.js';

export type FarmFile = {
  id: string;
  originalName: string;
  mediaType: string;
  byteSize: number;
  note: string;
};

export async function listFiles(db: Db, farmId: string): Promise<FarmFile[]> {
  const rows = await many<RowDataPacket & { id: string; original_name: string; media_type: string; byte_size: number; note: string }>(
    db,
    `SELECT id, original_name, media_type, byte_size, note FROM farm_files WHERE farm_id = ? ORDER BY created_at DESC`,
    [farmId],
  );
  return rows.map((row) => ({
    id: row.id,
    originalName: row.original_name,
    mediaType: row.media_type,
    byteSize: Number(row.byte_size),
    note: row.note,
  }));
}

export async function insertFile(
  db: Db,
  input: { farmId: string; originalName: string; storedName: string; mediaType: string; byteSize: number; note: string; createdBy: string },
): Promise<string> {
  const id = randomUUID();
  await exec(
    db,
    `INSERT INTO farm_files (id, farm_id, original_name, stored_name, media_type, byte_size, note, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, input.farmId, input.originalName, input.storedName, input.mediaType, input.byteSize, input.note, input.createdBy],
  );
  return id;
}

export async function findFile(db: Db, farmId: string, fileId: string): Promise<(FarmFile & { storedName: string }) | null> {
  const row = await one<RowDataPacket & { id: string; original_name: string; stored_name: string; media_type: string; byte_size: number; note: string }>(
    db,
    `SELECT id, original_name, stored_name, media_type, byte_size, note FROM farm_files WHERE farm_id = ? AND id = ?`,
    [farmId, fileId],
  );
  if (!row) return null;
  return {
    id: row.id,
    originalName: row.original_name,
    storedName: row.stored_name,
    mediaType: row.media_type,
    byteSize: Number(row.byte_size),
    note: row.note,
  };
}
