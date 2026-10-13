import { randomUUID } from 'node:crypto';
import type { RowDataPacket } from 'mysql2/promise';
import { asNumber, exec, many, one, type Db } from '../../db/sql.js';

export type StockItem = {
  id: string;
  name: string;
  unitLabel: string;
  reorderLevel: number | null;
  notes: string | null;
  onHand: number;
  belowReorder: boolean;
};

export type StockMovement = {
  id: string;
  itemId: string;
  itemName: string;
  unitLabel: string;
  movementType: 'receipt' | 'use' | 'wastage' | 'reversal';
  direction: 'in' | 'out';
  quantity: number;
  occurredOn: string;
  batchId: string | null;
  shedId: string | null;
  lotCode: string | null;
  expiresOn: string | null;
  unitCost: number | null;
  supplierName: string | null;
  reason: string | null;
};

export type WaterRecord = {
  id: string;
  recordedOn: string;
  batchId: string | null;
  shedId: string | null;
  quantity: number | null;
  unitLabel: string | null;
  sourceNote: string | null;
  testNote: string | null;
  notes: string | null;
  laboratoryResult: boolean;
};

export type GrowthTarget = {
  id: string;
  birdTypeId: string;
  birdTypeName: string;
  ageDays: number;
  targetWeight: number;
  weightUnit: 'kg' | 'g';
};

export type Weighing = {
  id: string;
  batchId: string;
  batchCode: string;
  birdTypeId: string;
  weighedOn: string;
  ageDays: number | null;
  weightValue: number;
  weightUnit: 'kg' | 'g';
  birdCount: number | null;
  notes: string | null;
  ownerTarget: { ageDays: number; targetWeight: number; weightUnit: 'kg' | 'g' } | null;
};

function asDate(value: Date | string): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

function asOptionalNumber(value: number | string | bigint | null): number | null {
  if (value === null) return null;
  return asNumber(value);
}

export async function listItems(db: Db, farmId: string): Promise<StockItem[]> {
  const rows = await many<
    RowDataPacket & {
      id: string;
      name: string;
      unit_label: string;
      reorder_level: number | string | null;
      notes: string | null;
      on_hand: number | string | null;
    }
  >(
    db,
    `SELECT i.id, i.name, i.unit_label, i.reorder_level, i.notes,
            COALESCE(SUM(CASE WHEN m.direction = 'in' THEN m.quantity ELSE -m.quantity END), 0) AS on_hand
     FROM stock_items i
     LEFT JOIN stock_movements m ON m.item_id = i.id
     WHERE i.farm_id = ?
     GROUP BY i.id, i.name, i.unit_label, i.reorder_level, i.notes
     ORDER BY i.name`,
    [farmId],
  );
  return rows.map((row) => {
    const onHand = asNumber(row.on_hand ?? 0);
    const reorderLevel = asOptionalNumber(row.reorder_level);
    return {
      id: row.id,
      name: row.name,
      unitLabel: row.unit_label,
      reorderLevel,
      notes: row.notes,
      onHand,
      belowReorder: reorderLevel !== null && onHand < reorderLevel,
    };
  });
}

export async function insertItem(
  db: Db,
  input: { farmId: string; name: string; unitLabel: string; reorderLevel: number | null; notes: string | null; createdBy: string },
): Promise<string> {
  const id = randomUUID();
  await exec(
    db,
    `INSERT INTO stock_items (id, farm_id, name, unit_label, reorder_level, notes, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, input.farmId, input.name, input.unitLabel, input.reorderLevel, input.notes, input.createdBy],
  );
  return id;
}

export async function lockItem(db: Db, farmId: string, itemId: string): Promise<boolean> {
  const row = await one<RowDataPacket>(db, `SELECT id FROM stock_items WHERE farm_id = ? AND id = ? FOR UPDATE`, [farmId, itemId]);
  return Boolean(row);
}

export async function onHand(db: Db, itemId: string): Promise<number> {
  const row = await one<RowDataPacket & { on_hand: number | string | null }>(
    db,
    `SELECT COALESCE(SUM(CASE WHEN direction = 'in' THEN quantity ELSE -quantity END), 0) AS on_hand FROM stock_movements WHERE item_id = ?`,
    [itemId],
  );
  return asNumber(row?.on_hand ?? 0);
}

export async function insertMovement(
  db: Db,
  input: {
    farmId: string;
    itemId: string;
    movementType: StockMovement['movementType'];
    direction: StockMovement['direction'];
    quantity: number;
    occurredOn: string;
    batchId: string | null;
    shedId: string | null;
    lotCode: string | null;
    expiresOn: string | null;
    unitCost: number | null;
    supplierName: string | null;
    reason: string | null;
    createdBy: string;
  },
): Promise<string> {
  const id = randomUUID();
  await exec(
    db,
    `INSERT INTO stock_movements
      (id, farm_id, item_id, movement_type, direction, quantity, occurred_on, batch_id, shed_id, lot_code, expires_on, unit_cost, supplier_name, reason, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.farmId,
      input.itemId,
      input.movementType,
      input.direction,
      input.quantity,
      input.occurredOn,
      input.batchId,
      input.shedId,
      input.lotCode,
      input.expiresOn,
      input.unitCost,
      input.supplierName,
      input.reason,
      input.createdBy,
    ],
  );
  return id;
}

export async function listMovements(db: Db, farmId: string): Promise<StockMovement[]> {
  const rows = await many<
    RowDataPacket & {
      id: string;
      item_id: string;
      item_name: string;
      unit_label: string;
      movement_type: StockMovement['movementType'];
      direction: StockMovement['direction'];
      quantity: number | string;
      occurred_on: Date | string;
      batch_id: string | null;
      shed_id: string | null;
      lot_code: string | null;
      expires_on: Date | string | null;
      unit_cost: number | string | null;
      supplier_name: string | null;
      reason: string | null;
    }
  >(
    db,
    `SELECT m.id, m.item_id, i.name AS item_name, i.unit_label, m.movement_type, m.direction, m.quantity, m.occurred_on,
            m.batch_id, m.shed_id, m.lot_code, m.expires_on, m.unit_cost, m.supplier_name, m.reason
     FROM stock_movements m
     JOIN stock_items i ON i.id = m.item_id
     WHERE m.farm_id = ?
     ORDER BY m.occurred_on DESC, m.created_at DESC
     LIMIT 50`,
    [farmId],
  );
  return rows.map((row) => ({
    id: row.id,
    itemId: row.item_id,
    itemName: row.item_name,
    unitLabel: row.unit_label,
    movementType: row.movement_type,
    direction: row.direction,
    quantity: asNumber(row.quantity),
    occurredOn: asDate(row.occurred_on),
    batchId: row.batch_id,
    shedId: row.shed_id,
    lotCode: row.lot_code,
    expiresOn: row.expires_on === null ? null : asDate(row.expires_on),
    unitCost: asOptionalNumber(row.unit_cost),
    supplierName: row.supplier_name,
    reason: row.reason,
  }));
}

export async function findBatch(db: Db, farmId: string, batchId: string): Promise<{ id: string; birdTypeId: string } | null> {
  const row = await one<RowDataPacket & { id: string; bird_type_id: string }>(
    db,
    `SELECT id, bird_type_id FROM batches WHERE farm_id = ? AND id = ?`,
    [farmId, batchId],
  );
  return row ? { id: row.id, birdTypeId: row.bird_type_id } : null;
}

export async function findShed(db: Db, farmId: string, shedId: string): Promise<boolean> {
  const row = await one<RowDataPacket>(db, `SELECT id FROM sheds WHERE farm_id = ? AND id = ?`, [farmId, shedId]);
  return Boolean(row);
}

export async function findActiveBirdType(db: Db, farmId: string, birdTypeId: string): Promise<boolean> {
  const row = await one<RowDataPacket>(
    db,
    `SELECT id FROM bird_types WHERE farm_id = ? AND id = ? AND status = 'active'`,
    [farmId, birdTypeId],
  );
  return Boolean(row);
}

export async function insertWater(
  db: Db,
  input: {
    farmId: string;
    recordedOn: string;
    batchId: string | null;
    shedId: string | null;
    quantity: number | null;
    unitLabel: string | null;
    sourceNote: string | null;
    testNote: string | null;
    notes: string | null;
    createdBy: string;
  },
): Promise<string> {
  const id = randomUUID();
  await exec(
    db,
    `INSERT INTO water_records
      (id, farm_id, recorded_on, batch_id, shed_id, quantity, unit_label, source_note, test_note, notes, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.farmId,
      input.recordedOn,
      input.batchId,
      input.shedId,
      input.quantity,
      input.unitLabel,
      input.sourceNote,
      input.testNote,
      input.notes,
      input.createdBy,
    ],
  );
  return id;
}

export async function listWater(db: Db, farmId: string): Promise<WaterRecord[]> {
  const rows = await many<
    RowDataPacket & {
      id: string;
      recorded_on: Date | string;
      batch_id: string | null;
      shed_id: string | null;
      quantity: number | string | null;
      unit_label: string | null;
      source_note: string | null;
      test_note: string | null;
      notes: string | null;
    }
  >(
    db,
    `SELECT id, recorded_on, batch_id, shed_id, quantity, unit_label, source_note, test_note, notes
     FROM water_records WHERE farm_id = ? ORDER BY recorded_on DESC, created_at DESC LIMIT 50`,
    [farmId],
  );
  return rows.map((row) => ({
    id: row.id,
    recordedOn: asDate(row.recorded_on),
    batchId: row.batch_id,
    shedId: row.shed_id,
    quantity: asOptionalNumber(row.quantity),
    unitLabel: row.unit_label,
    sourceNote: row.source_note,
    testNote: row.test_note,
    notes: row.notes,
    laboratoryResult: row.test_note !== null && row.test_note.length > 0,
  }));
}

export async function insertTarget(
  db: Db,
  input: {
    farmId: string;
    birdTypeId: string;
    ageDays: number;
    targetWeight: number;
    weightUnit: 'kg' | 'g';
    createdBy: string;
  },
): Promise<string> {
  const id = randomUUID();
  await exec(
    db,
    `INSERT INTO growth_targets (id, farm_id, bird_type_id, age_days, target_weight, weight_unit, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, input.farmId, input.birdTypeId, input.ageDays, input.targetWeight, input.weightUnit, input.createdBy],
  );
  return id;
}

export async function listTargets(db: Db, farmId: string): Promise<GrowthTarget[]> {
  const rows = await many<
    RowDataPacket & {
      id: string;
      bird_type_id: string;
      bird_type_name: string;
      age_days: number;
      target_weight: number | string;
      weight_unit: 'kg' | 'g';
    }
  >(
    db,
    `SELECT t.id, t.bird_type_id, b.name AS bird_type_name, t.age_days, t.target_weight, t.weight_unit
     FROM growth_targets t
     JOIN bird_types b ON b.id = t.bird_type_id
     WHERE t.farm_id = ?
     ORDER BY b.name, t.age_days`,
    [farmId],
  );
  return rows.map((row) => ({
    id: row.id,
    birdTypeId: row.bird_type_id,
    birdTypeName: row.bird_type_name,
    ageDays: Number(row.age_days),
    targetWeight: asNumber(row.target_weight),
    weightUnit: row.weight_unit,
  }));
}

export async function insertWeighing(
  db: Db,
  input: {
    farmId: string;
    batchId: string;
    weighedOn: string;
    ageDays: number | null;
    weightValue: number;
    weightUnit: 'kg' | 'g';
    birdCount: number | null;
    notes: string | null;
    createdBy: string;
  },
): Promise<string> {
  const id = randomUUID();
  await exec(
    db,
    `INSERT INTO growth_weighings
      (id, farm_id, batch_id, weighed_on, age_days, weight_value, weight_unit, bird_count, notes, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.farmId,
      input.batchId,
      input.weighedOn,
      input.ageDays,
      input.weightValue,
      input.weightUnit,
      input.birdCount,
      input.notes,
      input.createdBy,
    ],
  );
  return id;
}

export async function listWeighings(db: Db, farmId: string): Promise<Weighing[]> {
  const rows = await many<
    RowDataPacket & {
      id: string;
      batch_id: string;
      batch_code: string;
      bird_type_id: string;
      weighed_on: Date | string;
      age_days: number | null;
      weight_value: number | string;
      weight_unit: 'kg' | 'g';
      bird_count: number | null;
      notes: string | null;
      target_weight: number | string | null;
      target_unit: 'kg' | 'g' | null;
      target_age: number | null;
    }
  >(
    db,
    `SELECT w.id, w.batch_id, b.code AS batch_code, b.bird_type_id, w.weighed_on, w.age_days, w.weight_value, w.weight_unit,
            w.bird_count, w.notes, g.target_weight, g.weight_unit AS target_unit, g.age_days AS target_age
     FROM growth_weighings w
     JOIN batches b ON b.id = w.batch_id
     LEFT JOIN growth_targets g ON g.bird_type_id = b.bird_type_id AND g.age_days = w.age_days
     WHERE w.farm_id = ?
     ORDER BY w.weighed_on DESC, w.created_at DESC
     LIMIT 50`,
    [farmId],
  );
  return rows.map((row) => ({
    id: row.id,
    batchId: row.batch_id,
    batchCode: row.batch_code,
    birdTypeId: row.bird_type_id,
    weighedOn: asDate(row.weighed_on),
    ageDays: row.age_days === null ? null : Number(row.age_days),
    weightValue: asNumber(row.weight_value),
    weightUnit: row.weight_unit,
    birdCount: row.bird_count === null ? null : Number(row.bird_count),
    notes: row.notes,
    ownerTarget:
      row.target_weight === null || row.target_unit === null || row.target_age === null
        ? null
        : { ageDays: Number(row.target_age), targetWeight: asNumber(row.target_weight), weightUnit: row.target_unit },
  }));
}
