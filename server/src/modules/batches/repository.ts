import { randomUUID } from 'node:crypto';
import type { RowDataPacket } from 'mysql2/promise';
import type { BatchStatus, MovementType } from '@gavran/shared';
import { asNumber, exec, many, one, type Db, type SqlValue } from '../../db/sql.js';

export type BirdTypeRecord = {
  id: string;
  farmId: string;
  name: string;
  strainNote: string | null;
  status: 'active' | 'archived';
};

export type Placement = { shedId: string; shedCode: string; shedName: string; birdCount: number };
export type RangePlacement = { rangeAreaId: string; name: string; birdCount: number };

export type BatchRecord = {
  id: string;
  farmId: string;
  code: string;
  birdTypeId: string;
  birdTypeName: string;
  sourceNote: string | null;
  hatchDate: string | null;
  eggSetOn: string | null;
  openedOn: string;
  status: BatchStatus;
  version: number;
  liveCount: number;
  placements: Placement[];
  rangePlacements: RangePlacement[];
};

export type MovementRecord = {
  id: string;
  batchId: string;
  movementType: 'opening' | MovementType;
  fromShedId: string | null;
  toShedId: string | null;
  fromShedCode: string | null;
  toShedCode: string | null;
  fromRangeAreaId: string | null;
  toRangeAreaId: string | null;
  fromRangeName: string | null;
  toRangeName: string | null;
  birdCount: number;
  occurredOn: string;
  reason: string | null;
  createdAt: string;
};

type CountRow = RowDataPacket & { shed_id: string; shed_code: string; shed_name: string; live_count: number | string };
type ShedLock = RowDataPacket & { id: string; status: string; usable_capacity: number | string };

const LIVE_BY_BATCH = `
  SELECT s.id AS shed_id, s.code AS shed_code, s.name AS shed_name,
         COALESCE(SUM(CASE
           WHEN m.to_shed_id = s.id AND m.movement_type IN ('opening', 'transfer', 'from_range') THEN m.bird_count
           WHEN m.from_shed_id = s.id AND m.movement_type IN ('transfer', 'sale', 'mortality', 'culling', 'other_exit', 'to_range') THEN -m.bird_count
           ELSE 0
         END), 0) AS live_count
  FROM batch_movements m
  JOIN sheds s ON s.farm_id = m.farm_id AND (s.id = m.to_shed_id OR s.id = m.from_shed_id)
  WHERE m.farm_id = ? AND m.batch_id = ?
  GROUP BY s.id, s.code, s.name
  HAVING live_count <> 0
`;

export async function insertBirdType(db: Db, farmId: string, name: string, strainNote: string | null, createdBy: string): Promise<BirdTypeRecord> {
  const id = randomUUID();
  await exec(
    db,
    `INSERT INTO bird_types (id, farm_id, name, strain_note, created_by) VALUES (?, ?, ?, ?, ?)`,
    [id, farmId, name, strainNote, createdBy],
  );
  return { id, farmId, name, strainNote, status: 'active' };
}

export async function listBirdTypes(db: Db, farmId: string): Promise<BirdTypeRecord[]> {
  const rows = await many<RowDataPacket & { id: string; farm_id: string; name: string; strain_note: string | null; status: 'active' | 'archived' }>(
    db,
    `SELECT id, farm_id, name, strain_note, status FROM bird_types WHERE farm_id = ? ORDER BY name`,
    [farmId],
  );
  return rows.map((row) => ({ id: row.id, farmId: row.farm_id, name: row.name, strainNote: row.strain_note, status: row.status }));
}

export async function findActiveBirdType(db: Db, farmId: string, id: string): Promise<BirdTypeRecord | null> {
  const row = await one<RowDataPacket & { id: string; farm_id: string; name: string; strain_note: string | null; status: 'active' | 'archived' }>(
    db,
    `SELECT id, farm_id, name, strain_note, status FROM bird_types WHERE farm_id = ? AND id = ?`,
    [farmId, id],
  );
  if (!row || row.status !== 'active') return null;
  return { id: row.id, farmId: row.farm_id, name: row.name, strainNote: row.strain_note, status: row.status };
}

export async function lockSheds(db: Db, farmId: string, ids: string[]): Promise<Map<string, { status: string; usableCapacity: number }>> {
  const unique = [...new Set(ids)].sort();
  const map = new Map<string, { status: string; usableCapacity: number }>();
  if (unique.length === 0) return map;
  const placeholders = unique.map(() => '?').join(', ');
  const rows = await many<ShedLock>(
    db,
    `SELECT id, status, usable_capacity FROM sheds WHERE farm_id = ? AND id IN (${placeholders}) ORDER BY id FOR UPDATE`,
    [farmId, ...unique],
  );
  for (const row of rows) {
    map.set(row.id, { status: row.status, usableCapacity: asNumber(row.usable_capacity) });
  }
  return map;
}

export async function shedLiveCount(db: Db, farmId: string, shedId: string): Promise<number> {
  const row = await one<RowDataPacket & { live_count: number | string }>(
    db,
    `SELECT COALESCE(SUM(CASE
        WHEN to_shed_id = ? AND movement_type IN ('opening', 'transfer', 'from_range') THEN bird_count
        WHEN from_shed_id = ? AND movement_type IN ('transfer', 'sale', 'mortality', 'culling', 'other_exit', 'to_range') THEN -bird_count
        ELSE 0
      END), 0) AS live_count
     FROM batch_movements
     WHERE farm_id = ?`,
    [shedId, shedId, farmId],
  );
  return asNumber(row?.live_count ?? 0);
}

export async function batchShedLiveCount(db: Db, farmId: string, batchId: string, shedId: string): Promise<number> {
  const row = await one<RowDataPacket & { live_count: number | string }>(
    db,
    `SELECT COALESCE(SUM(CASE
        WHEN to_shed_id = ? AND movement_type IN ('opening', 'transfer', 'from_range') THEN bird_count
        WHEN from_shed_id = ? AND movement_type IN ('transfer', 'sale', 'mortality', 'culling', 'other_exit', 'to_range') THEN -bird_count
        ELSE 0
      END), 0) AS live_count
     FROM batch_movements
     WHERE farm_id = ? AND batch_id = ?`,
    [shedId, shedId, farmId, batchId],
  );
  return asNumber(row?.live_count ?? 0);
}

async function placementsFor(db: Db, farmId: string, batchId: string): Promise<Placement[]> {
  const rows = await many<CountRow>(db, LIVE_BY_BATCH, [farmId, batchId]);
  return rows
    .map((row) => ({
      shedId: row.shed_id,
      shedCode: row.shed_code,
      shedName: row.shed_name,
      birdCount: asNumber(row.live_count),
    }))
    .filter((row) => row.birdCount > 0)
    .sort((a, b) => a.shedCode.localeCompare(b.shedCode));
}

async function rangePlacementsFor(db: Db, farmId: string, batchId: string): Promise<RangePlacement[]> {
  const rows = await many<RowDataPacket & { range_area_id: string; name: string; live_count: number | string }>(
    db,
    `SELECT a.id AS range_area_id, a.name,
            COALESCE(SUM(CASE
              WHEN m.to_range_area_id = a.id AND m.movement_type = 'to_range' THEN m.bird_count
              WHEN m.from_range_area_id = a.id AND m.movement_type IN ('from_range', 'sale', 'mortality', 'culling', 'other_exit') THEN -m.bird_count
              ELSE 0
            END), 0) AS live_count
     FROM batch_movements m
     JOIN range_areas a ON a.farm_id = m.farm_id AND (a.id = m.to_range_area_id OR a.id = m.from_range_area_id)
     WHERE m.farm_id = ? AND m.batch_id = ?
     GROUP BY a.id, a.name
     HAVING live_count <> 0`,
    [farmId, batchId],
  );
  return rows
    .map((row) => ({ rangeAreaId: row.range_area_id, name: row.name, birdCount: asNumber(row.live_count) }))
    .filter((row) => row.birdCount > 0)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function rangeLiveCount(db: Db, farmId: string, batchId: string, rangeAreaId: string): Promise<number> {
  const row = await one<RowDataPacket & { live_count: number | string }>(
    db,
    `SELECT COALESCE(SUM(CASE
        WHEN to_range_area_id = ? AND movement_type = 'to_range' THEN bird_count
        WHEN from_range_area_id = ? AND movement_type IN ('from_range', 'sale', 'mortality', 'culling', 'other_exit') THEN -bird_count
        ELSE 0
      END), 0) AS live_count
     FROM batch_movements
     WHERE farm_id = ? AND batch_id = ?`,
    [rangeAreaId, rangeAreaId, farmId, batchId],
  );
  return asNumber(row?.live_count ?? 0);
}

type BatchRow = RowDataPacket & {
  id: string;
  farm_id: string;
  code: string;
  bird_type_id: string;
  bird_type_name: string;
  source_note: string | null;
  hatch_date: Date | string | null;
  egg_set_on: Date | string | null;
  opened_on: Date | string;
  status: BatchStatus;
  version: number;
};

function asDate(value: Date | string | null): string | null {
  if (value === null) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

async function mapBatch(db: Db, row: BatchRow): Promise<BatchRecord> {
  const placements = await placementsFor(db, row.farm_id, row.id);
  const rangePlacements = await rangePlacementsFor(db, row.farm_id, row.id);
  return {
    id: row.id,
    farmId: row.farm_id,
    code: row.code,
    birdTypeId: row.bird_type_id,
    birdTypeName: row.bird_type_name,
    sourceNote: row.source_note,
    hatchDate: asDate(row.hatch_date),
    eggSetOn: asDate(row.egg_set_on),
    openedOn: asDate(row.opened_on) ?? '',
    status: row.status,
    version: Number(row.version),
    liveCount: placements.reduce((sum, item) => sum + item.birdCount, 0) + rangePlacements.reduce((sum, item) => sum + item.birdCount, 0),
    placements,
    rangePlacements,
  };
}

const BATCH_SELECT = `
  SELECT b.id, b.farm_id, b.code, b.bird_type_id, t.name AS bird_type_name, b.source_note,
         b.hatch_date, b.egg_set_on, b.opened_on, b.status, b.version
  FROM batches b
  JOIN bird_types t ON t.id = b.bird_type_id
`;

export async function insertBatch(
  db: Db,
  input: {
    farmId: string;
    code: string;
    birdTypeId: string;
    sourceNote: string | null;
    hatchDate: string | null;
    eggSetOn?: string | null;
    openedOn: string;
    shedId: string;
    birdCount: number;
    createdBy: string;
  },
): Promise<string> {
  const id = randomUUID();
  await exec(
    db,
    `INSERT INTO batches
      (id, farm_id, code, bird_type_id, source_note, hatch_date, opened_on, created_by, egg_set_on)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, input.farmId, input.code, input.birdTypeId, input.sourceNote, input.hatchDate, input.openedOn, input.createdBy, input.eggSetOn ?? null],
  );
  await insertMovement(db, {
    farmId: input.farmId,
    batchId: id,
    movementType: 'opening',
    fromShedId: null,
    toShedId: input.shedId,
    birdCount: input.birdCount,
    occurredOn: input.openedOn,
    reason: null,
    createdBy: input.createdBy,
  });
  return id;
}

export async function insertMovement(
  db: Db,
  input: {
    farmId: string;
    batchId: string;
    movementType: 'opening' | MovementType;
    fromShedId: string | null;
    toShedId: string | null;
    fromRangeAreaId?: string | null;
    toRangeAreaId?: string | null;
    birdCount: number;
    occurredOn: string;
    reason: string | null;
    createdBy: string;
  },
): Promise<string> {
  const id = randomUUID();
  const params: SqlValue[] = [
    id,
    input.farmId,
    input.batchId,
    input.movementType,
    input.fromShedId,
    input.toShedId,
    input.toRangeAreaId ?? null,
    input.fromRangeAreaId ?? null,
    input.birdCount,
    input.occurredOn,
    input.reason,
    input.createdBy,
  ];
  await exec(
    db,
    `INSERT INTO batch_movements
      (id, farm_id, batch_id, movement_type, from_shed_id, to_shed_id, to_range_area_id, from_range_area_id, bird_count, occurred_on, reason, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    params,
  );
  return id;
}

export async function listBatches(db: Db, farmId: string): Promise<BatchRecord[]> {
  const rows = await many<BatchRow>(db, `${BATCH_SELECT} WHERE b.farm_id = ? ORDER BY b.opened_on DESC, b.code`, [farmId]);
  const batches: BatchRecord[] = [];
  for (const row of rows) batches.push(await mapBatch(db, row));
  return batches;
}

export async function findBatch(db: Db, farmId: string, batchId: string, lock: boolean): Promise<BatchRecord | null> {
  const row = await one<BatchRow>(
    db,
    `${BATCH_SELECT} WHERE b.farm_id = ? AND b.id = ?${lock ? ' FOR UPDATE' : ''}`,
    [farmId, batchId],
  );
  if (!row) return null;
  return mapBatch(db, row);
}

export async function closeBatch(db: Db, batchId: string, version: number): Promise<boolean> {
  const result = await exec(
    db,
    `UPDATE batches SET status = 'closed', closed_at = CURRENT_TIMESTAMP(3), version = version + 1
     WHERE id = ? AND version = ? AND status = 'open'`,
    [batchId, version],
  );
  return result.affectedRows === 1;
}

export async function listMovements(db: Db, farmId: string, batchId: string): Promise<MovementRecord[]> {
  const rows = await many<
    RowDataPacket & {
      id: string;
      batch_id: string;
      movement_type: MovementRecord['movementType'];
      from_shed_id: string | null;
      to_shed_id: string | null;
      from_code: string | null;
      to_code: string | null;
      from_range_area_id: string | null;
      to_range_area_id: string | null;
      from_range_name: string | null;
      to_range_name: string | null;
      bird_count: number;
      occurred_on: Date | string;
      reason: string | null;
      created_at: Date;
    }
  >(
    db,
    `SELECT m.id, m.batch_id, m.movement_type, m.from_shed_id, m.to_shed_id,
            m.from_range_area_id, m.to_range_area_id,
            fs.code AS from_code, ts.code AS to_code,
            fr.name AS from_range_name, tr.name AS to_range_name,
            m.bird_count, m.occurred_on, m.reason, m.created_at
     FROM batch_movements m
     LEFT JOIN sheds fs ON fs.id = m.from_shed_id
     LEFT JOIN sheds ts ON ts.id = m.to_shed_id
     LEFT JOIN range_areas fr ON fr.id = m.from_range_area_id
     LEFT JOIN range_areas tr ON tr.id = m.to_range_area_id
     WHERE m.farm_id = ? AND m.batch_id = ?
     ORDER BY m.occurred_on DESC, m.created_at DESC`,
    [farmId, batchId],
  );
  return rows.map((row) => ({
    id: row.id,
    batchId: row.batch_id,
    movementType: row.movement_type,
    fromShedId: row.from_shed_id,
    toShedId: row.to_shed_id,
    fromShedCode: row.from_code,
    toShedCode: row.to_code,
    fromRangeAreaId: row.from_range_area_id,
    toRangeAreaId: row.to_range_area_id,
    fromRangeName: row.from_range_name,
    toRangeName: row.to_range_name,
    birdCount: asNumber(row.bird_count),
    occurredOn: asDate(row.occurred_on) ?? '',
    reason: row.reason,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : new Date(row.created_at).toISOString(),
  }));
}

export async function listRangeAreas(db: Db, farmId: string): Promise<Array<{ id: string; name: string; notes: string | null }>> {
  const rows = await many<RowDataPacket & { id: string; name: string; notes: string | null }>(
    db,
    `SELECT id, name, notes FROM range_areas WHERE farm_id = ? ORDER BY name`,
    [farmId],
  );
  return rows.map((row) => ({ id: row.id, name: row.name, notes: row.notes }));
}

export async function insertRangeArea(db: Db, farmId: string, name: string, notes: string | null, createdBy: string): Promise<string> {
  const id = randomUUID();
  await exec(db, `INSERT INTO range_areas (id, farm_id, name, notes, created_by) VALUES (?, ?, ?, ?, ?)`, [id, farmId, name, notes, createdBy]);
  return id;
}

export async function rangeAreaExists(db: Db, farmId: string, id: string): Promise<boolean> {
  const row = await one<RowDataPacket>(db, `SELECT id FROM range_areas WHERE farm_id = ? AND id = ?`, [farmId, id]);
  return Boolean(row);
}

export type SexCountRecord = {
  id: string;
  countedOn: string;
  batchId: string | null;
  batchCode: string | null;
  roosterCount: number;
  henCount: number;
};

export async function listSexCounts(db: Db, farmId: string): Promise<SexCountRecord[]> {
  const rows = await many<RowDataPacket & { id: string; counted_on: Date | string; batch_id: string | null; batch_code: string | null; rooster_count: number; hen_count: number }>(
    db,
    `SELECT s.id, s.counted_on, s.batch_id, b.code AS batch_code, s.rooster_count, s.hen_count
     FROM sex_counts s
     LEFT JOIN batches b ON b.id = s.batch_id
     WHERE s.farm_id = ?
     ORDER BY s.counted_on DESC, s.created_at DESC
     LIMIT 50`,
    [farmId],
  );
  return rows.map((row) => ({
    id: row.id,
    countedOn: asDate(row.counted_on) ?? '',
    batchId: row.batch_id,
    batchCode: row.batch_code,
    roosterCount: Number(row.rooster_count),
    henCount: Number(row.hen_count),
  }));
}

export async function insertSexCount(
  db: Db,
  input: { farmId: string; batchId: string | null; countedOn: string; roosterCount: number; henCount: number; createdBy: string },
): Promise<string> {
  const id = randomUUID();
  await exec(
    db,
    `INSERT INTO sex_counts (id, farm_id, batch_id, counted_on, rooster_count, hen_count, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, input.farmId, input.batchId, input.countedOn, input.roosterCount, input.henCount, input.createdBy],
  );
  return id;
}

export async function batchOnFarm(db: Db, farmId: string, batchId: string): Promise<boolean> {
  const row = await one<RowDataPacket>(db, `SELECT id FROM batches WHERE farm_id = ? AND id = ?`, [farmId, batchId]);
  return Boolean(row);
}
