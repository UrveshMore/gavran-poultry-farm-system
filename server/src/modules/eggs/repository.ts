import { randomUUID } from 'node:crypto';
import type { RowDataPacket } from 'mysql2/promise';
import { asNumber, exec, many, one, type Db } from '../../db/sql.js';

export type EggPurpose = 'incubator' | 'sale' | 'eaten' | 'broken';

export type EggCategory = { id: string; name: string; status: 'active' | 'archived'; purpose: EggPurpose | null };

export type EggLine = { categoryId: string; categoryName: string; eggCount: number; purpose: EggPurpose | null };

export type EggCollection = {
  id: string;
  collectedOn: string;
  batchId: string | null;
  batchCode: string | null;
  shedId: string | null;
  shedCode: string | null;
  shiftLabel: string | null;
  notes: string | null;
  total: number;
  lines: EggLine[];
};

function asDate(value: Date | string): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

export async function listEggCategories(db: Db, farmId: string): Promise<EggCategory[]> {
  const rows = await many<RowDataPacket & EggCategory>(
    db,
    `SELECT id, name, status, purpose FROM egg_categories WHERE farm_id = ? ORDER BY name`,
    [farmId],
  );
  return rows.map((row) => ({ id: row.id, name: row.name, status: row.status, purpose: row.purpose ?? null }));
}

const EGG_PURPOSES: Array<{ purpose: EggPurpose; name: string }> = [
  { purpose: 'incubator', name: 'For incubator' },
  { purpose: 'sale', name: 'For sale' },
  { purpose: 'eaten', name: 'Eaten at home' },
  { purpose: 'broken', name: 'Broken' },
];

export async function ensureEggPurposes(db: Db, farmId: string, createdBy: string): Promise<EggCategory[]> {
  const existing = await listEggCategories(db, farmId);
  for (const item of EGG_PURPOSES) {
    if (existing.some((row) => row.purpose === item.purpose)) continue;
    const named = existing.find((row) => row.name.localeCompare(item.name, undefined, { sensitivity: 'accent' }) === 0);
    if (named) {
      await exec(db, `UPDATE egg_categories SET purpose = ? WHERE id = ? AND purpose IS NULL`, [item.purpose, named.id]);
      named.purpose = item.purpose;
      continue;
    }
    const id = randomUUID();
    await exec(db, `INSERT INTO egg_categories (id, farm_id, name, created_by, purpose) VALUES (?, ?, ?, ?, ?)`, [
      id,
      farmId,
      item.name,
      createdBy,
      item.purpose,
    ]);
    existing.push({ id, name: item.name, status: 'active', purpose: item.purpose });
  }
  return listEggCategories(db, farmId);
}

export async function insertEggCategory(db: Db, farmId: string, name: string, createdBy: string): Promise<EggCategory> {
  const id = randomUUID();
  await exec(db, `INSERT INTO egg_categories (id, farm_id, name, created_by) VALUES (?, ?, ?, ?)`, [id, farmId, name, createdBy]);
  return { id, name, status: 'active', purpose: null };
}

export async function findOpenBatch(db: Db, farmId: string, batchId: string): Promise<boolean> {
  const row = await one<RowDataPacket>(db, `SELECT id FROM batches WHERE farm_id = ? AND id = ? AND status = 'open'`, [farmId, batchId]);
  return Boolean(row);
}

export async function findShed(db: Db, farmId: string, shedId: string): Promise<boolean> {
  const row = await one<RowDataPacket>(db, `SELECT id FROM sheds WHERE farm_id = ? AND id = ?`, [farmId, shedId]);
  return Boolean(row);
}

export async function insertCollection(
  db: Db,
  input: {
    farmId: string;
    batchId: string | null;
    shedId: string | null;
    collectedOn: string;
    shiftLabel: string | null;
    notes: string | null;
    createdBy: string;
    lines: Array<{ categoryId: string; eggCount: number }>;
  },
): Promise<string> {
  const id = randomUUID();
  await exec(
    db,
    `INSERT INTO egg_collections
      (id, farm_id, batch_id, shed_id, collected_on, shift_label, notes, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, input.farmId, input.batchId, input.shedId, input.collectedOn, input.shiftLabel, input.notes, input.createdBy],
  );
  for (const line of input.lines) {
    if (line.eggCount === 0) continue;
    await exec(
      db,
      `INSERT INTO egg_collection_lines (id, collection_id, category_id, egg_count) VALUES (?, ?, ?, ?)`,
      [randomUUID(), id, line.categoryId, line.eggCount],
    );
  }
  return id;
}

export async function listCollections(db: Db, farmId: string): Promise<EggCollection[]> {
  const rows = await many<
    RowDataPacket & {
      id: string;
      collected_on: Date | string;
      batch_id: string | null;
      batch_code: string | null;
      shed_id: string | null;
      shed_code: string | null;
      shift_label: string | null;
      notes: string | null;
    }
  >(
    db,
    `SELECT c.id, c.collected_on, c.batch_id, b.code AS batch_code, c.shed_id, s.code AS shed_code, c.shift_label, c.notes
     FROM egg_collections c
     LEFT JOIN batches b ON b.id = c.batch_id
     LEFT JOIN sheds s ON s.id = c.shed_id
     WHERE c.farm_id = ?
     ORDER BY c.collected_on DESC, c.created_at DESC
     LIMIT 50`,
    [farmId],
  );
  if (rows.length === 0) return [];
  const ids = rows.map((row) => row.id);
  const placeholders = ids.map(() => '?').join(', ');
  const lines = await many<RowDataPacket & { collection_id: string; category_id: string; name: string; egg_count: number; purpose: EggPurpose | null }>(
    db,
    `SELECT l.collection_id, l.category_id, g.name, l.egg_count, g.purpose
     FROM egg_collection_lines l
     JOIN egg_categories g ON g.id = l.category_id
     WHERE l.collection_id IN (${placeholders})
     ORDER BY g.name`,
    ids,
  );
  return rows.map((row) => {
    const own = lines
      .filter((line) => line.collection_id === row.id)
      .map((line) => ({ categoryId: line.category_id, categoryName: line.name, eggCount: asNumber(line.egg_count), purpose: line.purpose ?? null }));
    return {
      id: row.id,
      collectedOn: asDate(row.collected_on),
      batchId: row.batch_id,
      batchCode: row.batch_code,
      shedId: row.shed_id,
      shedCode: row.shed_code,
      shiftLabel: row.shift_label,
      notes: row.notes,
      total: own.reduce((sum, line) => sum + line.eggCount, 0),
      lines: own,
    };
  });
}

export async function activeCategoryIds(db: Db, farmId: string, ids: string[]): Promise<Set<string>> {
  if (ids.length === 0) return new Set();
  const placeholders = ids.map(() => '?').join(', ');
  const rows = await many<RowDataPacket & { id: string }>(
    db,
    `SELECT id FROM egg_categories WHERE farm_id = ? AND status = 'active' AND id IN (${placeholders})`,
    [farmId, ...ids],
  );
  return new Set(rows.map((row) => row.id));
}
