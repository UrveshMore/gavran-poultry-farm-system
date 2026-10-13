import { randomUUID } from 'node:crypto';
import type { RowDataPacket } from 'mysql2/promise';
import { asNumber, exec, many, one, type Db } from '../../db/sql.js';

export type IncubatorStatus = 'in_service' | 'out_of_service';
export type PowerStatus = 'on' | 'off' | 'unknown';
export type ReadingSource = 'manual' | 'sensor';

export type Incubator = {
  id: string;
  code: string;
  name: string;
  capacityEggs: number | null;
  status: IncubatorStatus;
  notes: string | null;
  version: number;
};

export type IncubatorReading = {
  id: string;
  recordedOn: string;
  recordedTime: string | null;
  temperatureValue: number | null;
  temperatureUnit: string | null;
  humidityValue: number | null;
  humidityUnit: string | null;
  powerStatus: PowerStatus;
  source: ReadingSource;
  notes: string | null;
};

export type Maintenance = {
  id: string;
  occurredOn: string;
  status: IncubatorStatus;
  notes: string | null;
};

function asDate(value: Date | string): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

function asTime(value: string | null): string | null {
  if (!value) return null;
  return String(value).slice(0, 5);
}

function asOptionalNumber(value: number | string | null): number | null {
  if (value === null) return null;
  return asNumber(value);
}

type IncubatorRow = RowDataPacket & {
  id: string;
  code: string;
  name: string;
  capacity_eggs: number | null;
  status: IncubatorStatus;
  notes: string | null;
  version: number;
};

function mapIncubator(row: IncubatorRow): Incubator {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    capacityEggs: row.capacity_eggs === null ? null : asNumber(row.capacity_eggs),
    status: row.status,
    notes: row.notes,
    version: asNumber(row.version),
  };
}

export async function listIncubators(db: Db, farmId: string): Promise<Incubator[]> {
  const rows = await many<IncubatorRow>(
    db,
    `SELECT id, code, name, capacity_eggs, status, notes, version
     FROM incubators WHERE farm_id = ? ORDER BY code`,
    [farmId],
  );
  return rows.map(mapIncubator);
}

export async function findIncubator(db: Db, farmId: string, incubatorId: string): Promise<Incubator | null> {
  const row = await one<IncubatorRow>(
    db,
    `SELECT id, code, name, capacity_eggs, status, notes, version
     FROM incubators WHERE farm_id = ? AND id = ?`,
    [farmId, incubatorId],
  );
  return row ? mapIncubator(row) : null;
}

export async function insertIncubator(
  db: Db,
  input: { farmId: string; code: string; name: string; capacityEggs: number | null; notes: string | null; createdBy: string },
): Promise<string> {
  const id = randomUUID();
  await exec(
    db,
    `INSERT INTO incubators (id, farm_id, code, name, capacity_eggs, notes, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, input.farmId, input.code, input.name, input.capacityEggs, input.notes, input.createdBy],
  );
  return id;
}

export async function insertReading(
  db: Db,
  input: {
    farmId: string;
    incubatorId: string;
    recordedOn: string;
    recordedTime: string | null;
    temperatureValue: number | null;
    temperatureUnit: string | null;
    humidityValue: number | null;
    humidityUnit: string | null;
    powerStatus: PowerStatus;
    source: ReadingSource;
    notes: string | null;
    createdBy: string;
  },
): Promise<string> {
  const id = randomUUID();
  await exec(
    db,
    `INSERT INTO incubator_readings
      (id, farm_id, incubator_id, recorded_on, recorded_time, temperature_value, temperature_unit,
       humidity_value, humidity_unit, power_status, source, notes, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.farmId,
      input.incubatorId,
      input.recordedOn,
      input.recordedTime,
      input.temperatureValue,
      input.temperatureUnit,
      input.humidityValue,
      input.humidityUnit,
      input.powerStatus,
      input.source,
      input.notes,
      input.createdBy,
    ],
  );
  return id;
}

export async function listReadings(db: Db, farmId: string, incubatorId: string): Promise<IncubatorReading[]> {
  const rows = await many<
    RowDataPacket & {
      id: string;
      recorded_on: Date | string;
      recorded_time: string | null;
      temperature_value: number | string | null;
      temperature_unit: string | null;
      humidity_value: number | string | null;
      humidity_unit: string | null;
      power_status: PowerStatus;
      source: ReadingSource;
      notes: string | null;
    }
  >(
    db,
    `SELECT id, recorded_on, recorded_time, temperature_value, temperature_unit, humidity_value, humidity_unit,
            power_status, source, notes
     FROM incubator_readings
     WHERE farm_id = ? AND incubator_id = ?
     ORDER BY recorded_on DESC, created_at DESC
     LIMIT 40`,
    [farmId, incubatorId],
  );
  return rows.map((row) => ({
    id: row.id,
    recordedOn: asDate(row.recorded_on),
    recordedTime: asTime(row.recorded_time),
    temperatureValue: asOptionalNumber(row.temperature_value),
    temperatureUnit: row.temperature_unit,
    humidityValue: asOptionalNumber(row.humidity_value),
    humidityUnit: row.humidity_unit,
    powerStatus: row.power_status,
    source: row.source,
    notes: row.notes,
  }));
}

export async function insertMaintenance(
  db: Db,
  input: { farmId: string; incubatorId: string; occurredOn: string; status: IncubatorStatus; notes: string | null; createdBy: string },
): Promise<string> {
  const id = randomUUID();
  await exec(
    db,
    `INSERT INTO incubator_maintenance (id, farm_id, incubator_id, occurred_on, status, notes, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, input.farmId, input.incubatorId, input.occurredOn, input.status, input.notes, input.createdBy],
  );
  await exec(db, `UPDATE incubators SET status = ?, version = version + 1 WHERE farm_id = ? AND id = ?`, [
    input.status,
    input.farmId,
    input.incubatorId,
  ]);
  return id;
}

export async function listMaintenance(db: Db, farmId: string, incubatorId: string): Promise<Maintenance[]> {
  const rows = await many<RowDataPacket & { id: string; occurred_on: Date | string; status: IncubatorStatus; notes: string | null }>(
    db,
    `SELECT id, occurred_on, status, notes FROM incubator_maintenance
     WHERE farm_id = ? AND incubator_id = ?
     ORDER BY occurred_on DESC, created_at DESC
     LIMIT 20`,
    [farmId, incubatorId],
  );
  return rows.map((row) => ({ id: row.id, occurredOn: asDate(row.occurred_on), status: row.status, notes: row.notes }));
}
