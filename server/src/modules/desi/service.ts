import { birdEventInputSchema, eggLotInputSchema, trayHatchInputSchema, trayInputSchema, traySetInputSchema } from '@gavran/shared';
import type { RowDataPacket } from 'mysql2';
import { randomUUID } from 'node:crypto';
import { asNumber, exec, many, one } from '../../db/sql.js';
import { pool } from '../../db/pool.js';
import { withTransaction } from '../../db/transaction.js';
import { AppError } from '../../http/errors.js';
import { writeAudit } from '../audit/repository.js';
import type { AuthUser } from '../auth/types.js';
import {
  findBatch,
  insertBatch,
  insertBirdType,
  insertMovement,
  lockSheds,
  shedLiveCount,
} from '../batches/repository.js';
import { todayInTimeZone } from '../batches/service.js';
import type { FarmAccess } from '../farms/access.js';
import { findFarmById } from '../farms/repository.js';

type Actor = { user: AuthUser; requestId: string };

function asDay(value: Date | string | null): string | null {
  if (value === null) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

async function today(farmId: string): Promise<string> {
  const farm = await findFarmById(pool, farmId, false);
  if (!farm) throw new AppError(404, 'NOT_FOUND', 'Not found.');
  return todayInTimeZone(farm.timezone);
}

function assertNotFuture(day: string, farmToday: string, field: string) {
  if (day > farmToday) throw new AppError(422, 'VALIDATION_ERROR', 'That date is in the future.', { fields: { [field]: 'future_date' } });
}

async function ensureGavran(db: Parameters<typeof insertBirdType>[0], farmId: string, userId: string): Promise<string> {
  const row = await one<RowDataPacket & { id: string }>(
    db,
    `SELECT id FROM bird_types WHERE farm_id = ? AND name = 'Gavran' AND status = 'active' LIMIT 1`,
    [farmId],
  );
  if (row) return row.id;
  const created = await insertBirdType(db, farmId, 'Gavran', null, userId);
  return created.id;
}

export async function getDesi(farmId: string) {
  const lots = await many<RowDataPacket & { id: string; source_name: string; received_on: Date | string; egg_count: number; notes: string | null }>(
    pool,
    `SELECT id, source_name, received_on, egg_count, notes FROM egg_lots WHERE farm_id = ? ORDER BY received_on DESC LIMIT 50`,
    [farmId],
  );
  const trays = await many<RowDataPacket & { id: string; incubator_id: string; incubator_code: string; name: string }>(
    pool,
    `SELECT t.id, t.incubator_id, i.code AS incubator_code, t.name
     FROM incubator_trays t JOIN incubators i ON i.id = t.incubator_id
     WHERE t.farm_id = ? ORDER BY i.code, t.name`,
    [farmId],
  );
  const sets = await many<RowDataPacket & { id: string; tray_id: string; lot_id: string | null; set_on: Date | string; egg_count: number; status: 'open' | 'closed' }>(
    pool,
    `SELECT id, tray_id, lot_id, set_on, egg_count, status FROM tray_sets WHERE farm_id = ? ORDER BY set_on DESC LIMIT 50`,
    [farmId],
  );
  const days = await many<RowDataPacket & { id: string; tray_set_id: string; hatched_on: Date | string; live_count: number; batch_id: string | null; batch_code: string | null }>(
    pool,
    `SELECT d.id, d.tray_set_id, d.hatched_on, d.live_count, d.batch_id, b.code AS batch_code
     FROM tray_hatch_days d LEFT JOIN batches b ON b.id = d.batch_id
     WHERE d.farm_id = ? ORDER BY d.hatched_on`,
    [farmId],
  );
  const events = await many<RowDataPacket & { id: string; occurred_on: Date | string; kind: 'died' | 'sold' | 'eaten'; bird_count: number; amount: number | string | null; unit_label: string | null; notes: string | null; batch_code: string | null }>(
    pool,
    `SELECT e.id, e.occurred_on, e.kind, e.bird_count, e.amount, e.unit_label, e.notes, b.code AS batch_code
     FROM bird_events e LEFT JOIN batches b ON b.id = e.batch_id
     WHERE e.farm_id = ? ORDER BY e.occurred_on DESC LIMIT 50`,
    [farmId],
  );
  return {
    lots: lots.map((row) => ({ id: row.id, sourceName: row.source_name, receivedOn: asDay(row.received_on), eggCount: row.egg_count, notes: row.notes })),
    trays: trays.map((row) => ({ id: row.id, incubatorId: row.incubator_id, incubatorCode: row.incubator_code, name: row.name })),
    sets: sets.map((row) => {
      const own = days.filter((day) => day.tray_set_id === row.id);
      const live = own.reduce((sum, day) => sum + day.live_count, 0);
      return {
        id: row.id,
        trayId: row.tray_id,
        lotId: row.lot_id,
        setOn: asDay(row.set_on),
        eggCount: row.egg_count,
        status: row.status,
        live,
        bad: row.egg_count - live,
        ratio: row.egg_count > 0 ? Math.round((live / row.egg_count) * 1000) / 10 : null,
        ratioBasis: 'not_set' as const,
        days: own.map((day) => ({
          id: day.id,
          hatchedOn: asDay(day.hatched_on),
          liveCount: day.live_count,
          batchId: day.batch_id,
          batchCode: day.batch_code,
        })),
      };
    }),
    events: events.map((row) => ({
      id: row.id,
      occurredOn: asDay(row.occurred_on),
      kind: row.kind,
      birdCount: row.bird_count,
      amount: row.amount === null ? null : asNumber(row.amount),
      unitLabel: row.unit_label,
      notes: row.notes,
      batchCode: row.batch_code,
    })),
  };
}

export async function createLot(actor: Actor, access: FarmAccess, body: unknown) {
  const input = eggLotInputSchema.parse(body);
  assertNotFuture(input.receivedOn, await today(access.farmId), 'receivedOn');
  const id = randomUUID();
  await exec(pool, `INSERT INTO egg_lots (id, farm_id, source_name, received_on, egg_count, notes, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)`, [
    id,
    access.farmId,
    input.sourceName,
    input.receivedOn,
    input.eggCount,
    input.notes === '' ? null : input.notes,
    actor.user.id,
  ]);
  await writeAudit(pool, { farmId: access.farmId, actorUserId: actor.user.id, action: 'egg_lot.created', entityType: 'egg_lot', entityId: id, requestId: actor.requestId, summary: { name: input.sourceName } });
  return { id };
}

export async function createTray(actor: Actor, access: FarmAccess, body: unknown) {
  const input = trayInputSchema.parse(body);
  const machine = await one<RowDataPacket>(pool, `SELECT id FROM incubators WHERE farm_id = ? AND id = ?`, [access.farmId, input.incubatorId]);
  if (!machine) throw new AppError(422, 'VALIDATION_ERROR', 'Choose an incubator on this farm.', { fields: { incubatorId: 'invalid_format' } });
  const id = randomUUID();
  await exec(pool, `INSERT INTO incubator_trays (id, farm_id, incubator_id, name, created_by) VALUES (?, ?, ?, ?, ?)`, [
    id,
    access.farmId,
    input.incubatorId,
    input.name,
    actor.user.id,
  ]);
  return { id };
}

export async function createTraySet(actor: Actor, access: FarmAccess, body: unknown) {
  const input = traySetInputSchema.parse(body);
  assertNotFuture(input.setOn, await today(access.farmId), 'setOn');
  const tray = await one<RowDataPacket>(pool, `SELECT id FROM incubator_trays WHERE farm_id = ? AND id = ?`, [access.farmId, input.trayId]);
  if (!tray) throw new AppError(422, 'VALIDATION_ERROR', 'Choose a tray on this farm.', { fields: { trayId: 'invalid_format' } });
  if (input.lotId !== '') {
    const lot = await one<RowDataPacket>(pool, `SELECT id FROM egg_lots WHERE farm_id = ? AND id = ?`, [access.farmId, input.lotId]);
    if (!lot) throw new AppError(422, 'VALIDATION_ERROR', 'Choose an egg lot on this farm.', { fields: { lotId: 'invalid_format' } });
  }
  const id = randomUUID();
  await exec(pool, `INSERT INTO tray_sets (id, farm_id, tray_id, lot_id, set_on, egg_count, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)`, [
    id,
    access.farmId,
    input.trayId,
    input.lotId === '' ? null : input.lotId,
    input.setOn,
    input.eggCount,
    actor.user.id,
  ]);
  return { id };
}

export async function createHatchDay(actor: Actor, access: FarmAccess, setId: string, body: unknown) {
  const input = trayHatchInputSchema.parse(body);
  const farmToday = await today(access.farmId);
  assertNotFuture(input.hatchedOn, farmToday, 'hatchedOn');
  return withTransaction(async (conn) => {
    const sitting = await one<RowDataPacket & { id: string; set_on: Date | string; egg_count: number; status: string }>(
      conn,
      `SELECT id, set_on, egg_count, status FROM tray_sets WHERE farm_id = ? AND id = ? FOR UPDATE`,
      [access.farmId, setId],
    );
    if (!sitting || sitting.status !== 'open') throw new AppError(404, 'NOT_FOUND', 'Not found.');
    const sheds = await lockSheds(conn, access.farmId, [input.shedId]);
    const shed = sheds.get(input.shedId);
    if (!shed) throw new AppError(422, 'VALIDATION_ERROR', 'Choose a shed on this farm.', { fields: { shedId: 'invalid_format' } });
    if (shed.status !== 'active') throw new AppError(409, 'SHED_INACTIVE', 'Birds can be placed only in an active shed.');
    let batchId: string | null = null;
    if (input.liveCount > 0) {
      const living = await shedLiveCount(conn, access.farmId, input.shedId);
      if (living + input.liveCount > shed.usableCapacity) throw new AppError(409, 'CAPACITY_EXCEEDED', 'That shed does not have room for this count.');
      const birdTypeId = await ensureGavran(conn, access.farmId, actor.user.id);
      const setOn = asDay(sitting.set_on) ?? input.hatchedOn;
      batchId = await insertBatch(conn, {
        farmId: access.farmId,
        code: input.batchCode.toUpperCase(),
        birdTypeId,
        sourceNote: `tray ${setId.slice(0, 8)}`,
        hatchDate: input.hatchedOn,
        eggSetOn: setOn,
        openedOn: input.hatchedOn,
        shedId: input.shedId,
        birdCount: input.liveCount,
        createdBy: actor.user.id,
      });
    }
    const id = randomUUID();
    await exec(conn, `INSERT INTO tray_hatch_days (id, farm_id, tray_set_id, hatched_on, live_count, batch_id, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)`, [
      id,
      access.farmId,
      setId,
      input.hatchedOn,
      input.liveCount,
      batchId,
      actor.user.id,
    ]);
    return { id, batchId };
  });
}

export async function createBirdEvent(actor: Actor, access: FarmAccess, body: unknown) {
  const input = birdEventInputSchema.parse(body);
  assertNotFuture(input.occurredOn, await today(access.farmId), 'occurredOn');
  if (input.kind === 'sold' && !access.permissions.includes('sale.record')) {
    throw new AppError(403, 'FORBIDDEN', 'You cannot change that.');
  }
  return withTransaction(async (conn) => {
    let movementId: string | null = null;
    if (input.batchId !== '') {
      const batch = await findBatch(conn, access.farmId, input.batchId, true);
      if (!batch || batch.status !== 'open') throw new AppError(422, 'VALIDATION_ERROR', 'Choose an open flock.', { fields: { batchId: 'invalid_format' } });
      const shed = batch.placements.find((place) => place.birdCount >= input.birdCount);
      if (!shed) throw new AppError(409, 'INSUFFICIENT_BIRDS', 'That flock does not have that many birds in one shed.');
      const movementType = input.kind === 'died' ? 'mortality' : input.kind === 'sold' ? 'sale' : 'other_exit';
      movementId = await insertMovement(conn, {
        farmId: access.farmId,
        batchId: input.batchId,
        movementType,
        fromShedId: shed.shedId,
        toShedId: null,
        birdCount: input.birdCount,
        occurredOn: input.occurredOn,
        reason: input.notes === '' ? input.kind : input.notes,
        createdBy: actor.user.id,
      });
    }
    const id = randomUUID();
    await exec(
      conn,
      `INSERT INTO bird_events (id, farm_id, occurred_on, kind, bird_count, amount, unit_label, notes, batch_id, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        access.farmId,
        input.occurredOn,
        input.kind,
        input.birdCount,
        input.kind === 'sold' ? (input.amount ?? null) : null,
        input.kind === 'sold' ? input.unitLabel.trim() : null,
        input.notes === '' ? null : input.notes,
        input.batchId === '' ? null : input.batchId,
        actor.user.id,
      ],
    );
    if (input.kind === 'died') {
      await exec(conn, `INSERT INTO loss_incidents (id, farm_id, occurred_on, bird_count, note, movement_id, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)`, [
        randomUUID(),
        access.farmId,
        input.occurredOn,
        input.birdCount,
        input.notes === '' ? 'Died' : input.notes,
        movementId,
        actor.user.id,
      ]);
    }
    return { id };
  });
}
