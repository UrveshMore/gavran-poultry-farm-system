import {
  HATCH_LENGTH_DAYS,
  MOVE_REMINDER_DAYS,
  ageFromHatch,
  flowBatchInputSchema,
  flowDoseInputSchema,
  flowEggInputSchema,
  flowExpenseInputSchema,
  flowFeedInputSchema,
  flowHatchDayInputSchema,
  flowIncubatorInputSchema,
  flowMoveInputSchema,
  flowSaleInputSchema,
  flowShedInputSchema,
  plusDays,
  typedAmount,
} from '@gavran/shared';
import type { RowDataPacket } from 'mysql2';
import { randomUUID } from 'node:crypto';
import { asNumber, exec, isDup, many, one, type Db, type SqlValue } from '../../db/sql.js';
import { pool } from '../../db/pool.js';
import { withTransaction } from '../../db/transaction.js';
import { AppError } from '../../http/errors.js';
import { writeAudit } from '../audit/repository.js';
import type { AuthUser } from '../auth/types.js';
import { todayInTimeZone } from '../batches/service.js';
import type { FarmAccess } from '../farms/access.js';
import { findFarmById } from '../farms/repository.js';

type Actor = { user: AuthUser; requestId: string };
type MoveKind = 'opening' | 'brooding_death' | 'to_shed' | 'between_sheds' | 'exit';
type Reason = 'died' | 'sold' | 'other';

type IncRow = RowDataPacket & { id: string; name: string; capacity: number };
type ShedRow = RowDataPacket & { id: string; name: string; capacity: number };
type BatchRow = RowDataPacket & {
  id: string;
  batch_number: number;
  incubator_id: string | null;
  eggs_set: number | null;
  set_on: Date | string | null;
  hatch_on: Date | string | null;
  notes: string | null;
};
type HatchRow = RowDataPacket & { id: string; batch_id: string; day_number: number; live_count: number };
type MoveRow = RowDataPacket & {
  id: string;
  batch_id: string;
  kind: MoveKind;
  bird_count: number;
  occurred_on: Date | string;
  shed_id: string | null;
  from_shed_id: string | null;
  reason: Reason | null;
  notes: string | null;
};
type DoseRow = RowDataPacket & {
  id: string;
  day_from: number | null;
  day_to: number | null;
  day_label: string;
  slot: 'morning' | 'evening' | 'full_day';
  item_name: string;
  amount_text: string;
  unclear: number;
  source_page: number;
  sort_order: number;
};
type MarkRow = RowDataPacket & { id: string; batch_id: string; schedule_row_id: string; given_on: Date | string; notes: string | null };
type FeedRow = RowDataPacket & {
  id: string;
  batch_id: string;
  occurred_on: Date | string;
  age_day: number | null;
  season_label: string;
  feed_type: string;
  quantity: number | string;
  unit_label: string;
  notes: string | null;
};
type EggRow = RowDataPacket & { id: string; occurred_on: Date | string; collected: number; sold: number; for_incubator: number; notes: string | null };
type ExpenseRow = RowDataPacket & { id: string; occurred_on: Date | string; category: 'feed' | 'medicine' | 'electricity' | 'other'; amount: number | string; unit_label: string; notes: string | null };
type SaleRow = RowDataPacket & {
  id: string;
  occurred_on: Date | string;
  kind: 'eggs' | 'birds';
  quantity: number | string;
  price: number | string;
  amount: number | string;
  buyer: string;
  unit_label: string;
  batch_id: string | null;
  move_id: string | null;
  notes: string | null;
};

function asDay(value: Date | string | null): string | null {
  if (value === null) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

function blank(value: string): string | null {
  return value === '' ? null : value;
}

async function farmToday(farmId: string): Promise<string> {
  const farm = await findFarmById(pool, farmId, false);
  if (!farm) throw new AppError(404, 'NOT_FOUND', 'Not found.');
  return todayInTimeZone(farm.timezone);
}

function assertNotFuture(day: string, today: string, field: string) {
  if (day > today) throw new AppError(422, 'VALIDATION_ERROR', 'That date is in the future.', { fields: { [field]: 'future_date' } });
}

function placeOf(hatchLive: number, moves: MoveRow[]): { brooding: number; sheds: Map<string, number> } {
  const sheds = new Map<string, number>();
  let brooding = hatchLive;
  for (const move of moves) {
    const count = move.bird_count;
    if (move.kind === 'opening' && move.shed_id) sheds.set(move.shed_id, (sheds.get(move.shed_id) ?? 0) + count);
    if (move.kind === 'brooding_death') brooding -= count;
    if (move.kind === 'to_shed' && move.shed_id) {
      brooding -= count;
      sheds.set(move.shed_id, (sheds.get(move.shed_id) ?? 0) + count);
    }
    if (move.kind === 'between_sheds' && move.from_shed_id && move.shed_id) {
      sheds.set(move.from_shed_id, (sheds.get(move.from_shed_id) ?? 0) - count);
      sheds.set(move.shed_id, (sheds.get(move.shed_id) ?? 0) + count);
    }
    if (move.kind === 'exit' && move.shed_id) sheds.set(move.shed_id, (sheds.get(move.shed_id) ?? 0) - count);
  }
  return { brooding, sheds };
}

function assertPlace(place: { brooding: number; sheds: Map<string, number> }) {
  if (place.brooding < 0) {
    throw new AppError(422, 'VALIDATION_ERROR', 'That is more birds than are in brooding.', { fields: { birdCount: 'too_big' } });
  }
  for (const count of place.sheds.values()) {
    if (count < 0) throw new AppError(422, 'VALIDATION_ERROR', 'That is more birds than are in that shed.', { fields: { birdCount: 'too_big' } });
  }
}

function covers(row: DoseRow, age: number): boolean {
  return row.day_from !== null && row.day_to !== null && age >= row.day_from && age <= row.day_to;
}

function nextAge(age: number, rows: DoseRow[]): number | null {
  for (let day = age + 1; day <= 80; day += 1) {
    if (rows.some((row) => covers(row, day))) return day;
  }
  return null;
}

async function ensureIncubators(actor: Actor, farmId: string) {
  const existing = await one<RowDataPacket & { total: number }>(pool, `SELECT COUNT(*) AS total FROM flow_incubators WHERE farm_id = ?`, [farmId]);
  if (asNumber(existing?.total ?? 0) > 0) return;
  await withTransaction(async (conn) => {
    const again = await one<RowDataPacket & { total: number }>(conn, `SELECT COUNT(*) AS total FROM flow_incubators WHERE farm_id = ?`, [farmId]);
    if (asNumber(again?.total ?? 0) > 0) return;
    for (const item of [
      { name: 'Big box', capacity: 100 },
      { name: 'Small box', capacity: 80 },
    ]) {
      const id = randomUUID();
      await exec(conn, `INSERT INTO flow_incubators (id, farm_id, name, capacity, created_by) VALUES (?, ?, ?, ?, ?)`, [
        id,
        farmId,
        item.name,
        item.capacity,
        actor.user.id,
      ]);
    }
    await writeAudit(conn, {
      farmId,
      actorUserId: actor.user.id,
      action: 'flow_incubator.seeded',
      entityType: 'flow_incubator',
      entityId: farmId,
      requestId: actor.requestId,
      summary: { capacities: [100, 80] },
    });
  });
}

async function load(farmId: string) {
  const incubators = await many<IncRow>(pool, `SELECT id, name, capacity FROM flow_incubators WHERE farm_id = ? ORDER BY capacity DESC, name`, [farmId]);
  const sheds = await many<ShedRow>(pool, `SELECT id, name, capacity FROM flow_sheds WHERE farm_id = ? ORDER BY name`, [farmId]);
  const batches = await many<BatchRow>(
    pool,
    `SELECT id, batch_number, incubator_id, eggs_set, set_on, hatch_on, notes FROM flow_batches WHERE farm_id = ? ORDER BY batch_number`,
    [farmId],
  );
  const hatchDays = await many<HatchRow>(pool, `SELECT id, batch_id, day_number, live_count FROM flow_hatch_days WHERE farm_id = ? ORDER BY day_number`, [farmId]);
  const moves = await many<MoveRow>(
    pool,
    `SELECT id, batch_id, kind, bird_count, occurred_on, shed_id, from_shed_id, reason, notes FROM flow_moves WHERE farm_id = ? ORDER BY occurred_on, created_at`,
    [farmId],
  );
  const doseRows = await many<DoseRow>(
    pool,
    `SELECT r.id, r.day_from, r.day_to, r.day_label, r.slot, r.item_name, r.amount_text, r.unclear, r.source_page, r.sort_order
     FROM schedule_rows r JOIN schedule_templates t ON t.id = r.template_id
     WHERE t.code = 'patil-chick-days' ORDER BY r.sort_order`,
  );
  const marks = await many<MarkRow>(pool, `SELECT id, batch_id, schedule_row_id, given_on, notes FROM flow_dose_marks WHERE farm_id = ?`, [farmId]);
  const feed = await many<FeedRow>(
    pool,
    `SELECT id, batch_id, occurred_on, age_day, season_label, feed_type, quantity, unit_label, notes FROM flow_feed_entries WHERE farm_id = ? ORDER BY occurred_on DESC`,
    [farmId],
  );
  const eggs = await many<EggRow>(pool, `SELECT id, occurred_on, collected, sold, for_incubator, notes FROM flow_egg_entries WHERE farm_id = ? ORDER BY occurred_on DESC`, [farmId]);
  const expenses = await many<ExpenseRow>(pool, `SELECT id, occurred_on, category, amount, unit_label, notes FROM flow_expenses WHERE farm_id = ? ORDER BY occurred_on DESC`, [farmId]);
  const sales = await many<SaleRow>(
    pool,
    `SELECT id, occurred_on, kind, quantity, price, amount, buyer, unit_label, batch_id, move_id, notes FROM flow_sales WHERE farm_id = ? ORDER BY occurred_on DESC`,
    [farmId],
  );
  const setup = await one<RowDataPacket & { batch0_skipped: number }>(pool, `SELECT batch0_skipped FROM flow_setup WHERE farm_id = ?`, [farmId]);
  return { incubators, sheds, batches, hatchDays, moves, doseRows, marks, feed, eggs, expenses, sales, setup };
}

function batchView(batch: BatchRow, hatchDays: HatchRow[], moves: MoveRow[], sheds: ShedRow[], today: string) {
  const days = hatchDays.filter((day) => day.batch_id === batch.id);
  const ownMoves = moves.filter((move) => move.batch_id === batch.id);
  let running = 0;
  const hatch = days.map((day) => {
    running += day.live_count;
    return { id: day.id, dayNumber: day.day_number, liveCount: day.live_count, runningTotal: running };
  });
  const liveTotal = days.reduce((sum, day) => sum + day.live_count, 0);
  const eggsSet = batch.eggs_set;
  const place = placeOf(liveTotal, ownMoves);
  const hatchOn = asDay(batch.hatch_on);
  const ageDays = hatchOn ? ageFromHatch(hatchOn, today) : null;
  return {
    id: batch.id,
    number: batch.batch_number,
    incubatorId: batch.incubator_id,
    eggsSet,
    setOn: asDay(batch.set_on),
    hatchOn,
    notes: batch.notes,
    liveTotal,
    bad: eggsSet === null ? null : eggsSet - liveTotal,
    ratio: eggsSet && eggsSet > 0 ? Math.round((liveTotal / eggsSet) * 1000) / 10 : null,
    ratioBasis: 'not_set' as const,
    broodingLive: place.brooding,
    ageDays,
    moveReminder: ageDays !== null && ageDays >= MOVE_REMINDER_DAYS && place.brooding > 0,
    placements: [...place.sheds.entries()]
      .filter(([, count]) => count > 0)
      .map(([shedId, birdCount]) => ({ shedId, shedName: sheds.find((shed) => shed.id === shedId)?.name ?? '', birdCount })),
    hatchDays: hatch,
  };
}

export async function getFlow(actor: Actor, farmId: string) {
  await ensureIncubators(actor, farmId);
  const today = await farmToday(farmId);
  const data = await load(farmId);
  const batches = data.batches.map((batch) => {
    const view = batchView(batch, data.hatchDays, data.moves, data.sheds, today);
    return { ...view, medicine: medicineForBatch(view, data.doseRows, data.marks) };
  });
  const shedCounts = new Map<string, number>();
  for (const batch of batches) {
    for (const place of batch.placements) shedCounts.set(place.shedId, (shedCounts.get(place.shedId) ?? 0) + place.birdCount);
  }
  const eggsInUse = (incubatorId: string) =>
    data.batches
      .filter((batch) => batch.incubator_id === incubatorId && asDay(batch.hatch_on) !== null && (asDay(batch.hatch_on) as string) >= today)
      .reduce((sum, batch) => sum + (batch.eggs_set ?? 0), 0);
  const doseRows = data.doseRows.map((row) => ({
    id: row.id,
    dayFrom: row.day_from,
    dayTo: row.day_to,
    dayLabel: row.day_label,
    slot: row.slot,
    itemName: row.item_name,
    amountText: row.amount_text,
    unclear: row.unclear === 1,
    sourcePage: row.source_page,
    sortOrder: row.sort_order,
  }));
  const todayMedicine = batches.flatMap((batch) => {
    if (batch.ageDays === null || batch.ageDays < 1) return [];
    return data.doseRows.filter((row) => covers(row, batch.ageDays as number)).map((row) => ({
      batchId: batch.id,
      batchNumber: batch.number,
      rowId: row.id,
      itemName: row.item_name,
      slot: row.slot,
      amountText: row.amount_text,
      given: data.marks.some((mark) => mark.batch_id === batch.id && mark.schedule_row_id === row.id),
    }));
  });
  const month = today.slice(0, 7);
  const money = new Map<string, { sales: number; expenses: number }>();
  for (const sale of data.sales) {
    const day = asDay(sale.occurred_on);
    if (!day?.startsWith(month)) continue;
    const line = money.get(sale.unit_label) ?? { sales: 0, expenses: 0 };
    line.sales = typedAmount(line.sales + asNumber(sale.amount), 1);
    money.set(sale.unit_label, line);
  }
  for (const expense of data.expenses) {
    const day = asDay(expense.occurred_on);
    if (!day?.startsWith(month)) continue;
    const line = money.get(expense.unit_label) ?? { sales: 0, expenses: 0 };
    line.expenses = typedAmount(line.expenses + asNumber(expense.amount), 1);
    money.set(expense.unit_label, line);
  }
  const monthLines =
    money.size === 0
      ? [{ unit: 'Rs', sales: 0, expenses: 0, difference: 0, basis: 'not_set' as const }]
      : [...money.entries()].map(([unit, line]) => ({
          unit,
          sales: line.sales,
          expenses: line.expenses,
          difference: typedAmount(line.sales - line.expenses, 1),
          basis: 'not_set' as const,
        }));
  const eggStock = data.eggs.reduce((sum, row) => sum + row.collected - row.sold - row.for_incubator, 0);
  const batchNumber = new Map(batches.map((batch) => [batch.id, batch.number]));
  return {
    today,
    scheduleFound: doseRows.length > 0,
    scheduleSource: doseRows.length > 0 ? 'patil-poultry-step-by-step-process.pdf' : null,
    season: 'not_in_source' as const,
    lengths: { hatchDays: HATCH_LENGTH_DAYS, moveReminderDays: MOVE_REMINDER_DAYS, ratioBasis: 'not_set' as const, moneyBasis: 'not_set' as const },
    setup: {
      incubatorsReady: data.incubators.length > 0,
      hasShed: data.sheds.length > 0,
      hasBatch0: data.batches.some((batch) => batch.batch_number === 0),
      batch0Skipped: data.setup?.batch0_skipped === 1,
    },
    incubators: data.incubators.map((row) => {
      const inUse = eggsInUse(row.id);
      return { id: row.id, name: row.name, capacity: row.capacity, eggsInUse: inUse, overCapacity: inUse > row.capacity };
    }),
    sheds: data.sheds.map((row) => {
      const birdCount = shedCounts.get(row.id) ?? 0;
      return { id: row.id, name: row.name, capacity: row.capacity, birdCount, overCapacity: birdCount > row.capacity };
    }),
    batches,
    doseRows,
    doseMarks: data.marks.map((row) => ({ id: row.id, batchId: row.batch_id, scheduleRowId: row.schedule_row_id, givenOn: asDay(row.given_on), notes: row.notes })),
    feed: data.feed.map((row) => ({
      id: row.id,
      batchId: row.batch_id,
      batchNumber: batchNumber.get(row.batch_id) ?? null,
      occurredOn: asDay(row.occurred_on),
      ageDay: row.age_day,
      seasonLabel: row.season_label,
      feedType: row.feed_type,
      quantity: asNumber(row.quantity),
      unitLabel: row.unit_label,
      notes: row.notes,
    })),
    eggs: data.eggs.map((row) => ({
      id: row.id,
      occurredOn: asDay(row.occurred_on),
      collected: row.collected,
      sold: row.sold,
      forIncubator: row.for_incubator,
      notes: row.notes,
    })),
    eggStock,
    expenses: data.expenses.map((row) => ({
      id: row.id,
      occurredOn: asDay(row.occurred_on),
      category: row.category,
      amount: asNumber(row.amount),
      unitLabel: row.unit_label,
      notes: row.notes,
    })),
    sales: data.sales.map((row) => ({
      id: row.id,
      occurredOn: asDay(row.occurred_on),
      kind: row.kind,
      quantity: asNumber(row.quantity),
      price: asNumber(row.price),
      amount: asNumber(row.amount),
      buyer: row.buyer,
      unitLabel: row.unit_label,
      batchId: row.batch_id,
      moveId: row.move_id,
      notes: row.notes,
    })),
    home: {
      broodingCount: batches.reduce((sum, batch) => sum + batch.broodingLive, 0),
      shedCount: [...shedCounts.values()].reduce((sum, count) => sum + count, 0),
      todayMedicine,
      todayFeed: data.feed
        .filter((row) => asDay(row.occurred_on) === today)
        .map((row) => ({
          id: row.id,
          batchNumber: batchNumber.get(row.batch_id) ?? null,
          feedType: row.feed_type,
          quantity: asNumber(row.quantity),
          unitLabel: row.unit_label,
        })),
      todayEggs: data.eggs.filter((row) => asDay(row.occurred_on) === today).reduce((sum, row) => sum + row.collected, 0),
      month: monthLines,
    },
  };
}

function doseLine(row: DoseRow, batchId: string, marks: MarkRow[]) {
  const mark = marks.find((item) => item.batch_id === batchId && item.schedule_row_id === row.id);
  return {
    rowId: row.id,
    dayLabel: row.day_label,
    slot: row.slot,
    itemName: row.item_name,
    amountText: row.amount_text,
    unclear: row.unclear === 1,
    sourcePage: row.source_page,
    given: Boolean(mark),
    markId: mark?.id ?? null,
    givenOn: mark ? asDay(mark.given_on) : null,
  };
}

function medicineForBatch(batch: ReturnType<typeof batchView> | undefined, rows: DoseRow[], marks: MarkRow[]) {
  const vet = rows.filter((row) => row.unclear === 1 || row.day_from === null).map((row) => doseLine(row, batch?.id ?? '', marks));
  if (!batch || batch.ageDays === null) return { ageDays: null, today: [], nextDay: null, next: [], vet };
  const upcoming = nextAge(batch.ageDays < 1 ? 0 : batch.ageDays, rows);
  const todayLines = batch.ageDays < 1 ? [] : rows.filter((row) => covers(row, batch.ageDays as number)).map((row) => doseLine(row, batch.id, marks));
  return {
    ageDays: batch.ageDays,
    today: todayLines,
    nextDay: upcoming,
    next: upcoming === null ? [] : rows.filter((row) => covers(row, upcoming)).map((row) => doseLine(row, batch.id, marks)),
    vet,
  };
}

async function audit(db: Db, actor: Actor, farmId: string, action: string, entityType: string, entityId: string, summary: Record<string, SqlValue>) {
  await writeAudit(db, { farmId, actorUserId: actor.user.id, action, entityType, entityId, requestId: actor.requestId, summary });
}

export async function createIncubator(actor: Actor, access: FarmAccess, body: unknown) {
  const input = flowIncubatorInputSchema.parse(body);
  const id = randomUUID();
  await exec(pool, `INSERT INTO flow_incubators (id, farm_id, name, capacity, created_by) VALUES (?, ?, ?, ?, ?)`, [id, access.farmId, input.name, input.capacity, actor.user.id]);
  await audit(pool, actor, access.farmId, 'flow_incubator.created', 'flow_incubator', id, { name: input.name });
  return { id };
}

export async function updateIncubator(actor: Actor, access: FarmAccess, incubatorId: string, body: unknown) {
  const input = flowIncubatorInputSchema.parse(body);
  const result = await exec(pool, `UPDATE flow_incubators SET name = ?, capacity = ? WHERE id = ? AND farm_id = ?`, [input.name, input.capacity, incubatorId, access.farmId]);
  if (result.affectedRows === 0) throw new AppError(404, 'NOT_FOUND', 'Not found.');
  await audit(pool, actor, access.farmId, 'flow_incubator.updated', 'flow_incubator', incubatorId, { name: input.name });
  return { id: incubatorId };
}

export async function deleteIncubator(actor: Actor, access: FarmAccess, incubatorId: string) {
  const used = await one<RowDataPacket & { total: number }>(pool, `SELECT COUNT(*) AS total FROM flow_batches WHERE incubator_id = ?`, [incubatorId]);
  if (asNumber(used?.total ?? 0) > 0) throw new AppError(409, 'CONFLICT', 'This incubator still has a batch.');
  const result = await exec(pool, `DELETE FROM flow_incubators WHERE id = ? AND farm_id = ?`, [incubatorId, access.farmId]);
  if (result.affectedRows === 0) throw new AppError(404, 'NOT_FOUND', 'Not found.');
  await audit(pool, actor, access.farmId, 'flow_incubator.deleted', 'flow_incubator', incubatorId, {});
  return { id: incubatorId };
}

export async function createShed(actor: Actor, access: FarmAccess, body: unknown) {
  const input = flowShedInputSchema.parse(body);
  const id = randomUUID();
  await exec(pool, `INSERT INTO flow_sheds (id, farm_id, name, capacity, created_by) VALUES (?, ?, ?, ?, ?)`, [id, access.farmId, input.name, input.capacity, actor.user.id]);
  await audit(pool, actor, access.farmId, 'flow_shed.created', 'flow_shed', id, { name: input.name });
  return { id };
}

export async function updateShed(actor: Actor, access: FarmAccess, shedId: string, body: unknown) {
  const input = flowShedInputSchema.parse(body);
  const result = await exec(pool, `UPDATE flow_sheds SET name = ?, capacity = ? WHERE id = ? AND farm_id = ?`, [input.name, input.capacity, shedId, access.farmId]);
  if (result.affectedRows === 0) throw new AppError(404, 'NOT_FOUND', 'Not found.');
  await audit(pool, actor, access.farmId, 'flow_shed.updated', 'flow_shed', shedId, { name: input.name });
  return { id: shedId };
}

export async function deleteShed(actor: Actor, access: FarmAccess, shedId: string) {
  const used = await one<RowDataPacket & { total: number }>(
    pool,
    `SELECT COUNT(*) AS total FROM flow_moves WHERE shed_id = ? OR from_shed_id = ?`,
    [shedId, shedId],
  );
  if (asNumber(used?.total ?? 0) > 0) throw new AppError(409, 'CONFLICT', 'This shed still has a bird line.');
  const result = await exec(pool, `DELETE FROM flow_sheds WHERE id = ? AND farm_id = ?`, [shedId, access.farmId]);
  if (result.affectedRows === 0) throw new AppError(404, 'NOT_FOUND', 'Not found.');
  await audit(pool, actor, access.farmId, 'flow_shed.deleted', 'flow_shed', shedId, {});
  return { id: shedId };
}

async function capacityWarning(farmId: string, incubatorId: string, today: string): Promise<boolean> {
  const machine = await one<IncRow>(pool, `SELECT id, name, capacity FROM flow_incubators WHERE id = ? AND farm_id = ?`, [incubatorId, farmId]);
  if (!machine) return false;
  const rows = await many<BatchRow>(pool, `SELECT id, batch_number, incubator_id, eggs_set, set_on, hatch_on, notes FROM flow_batches WHERE farm_id = ? AND incubator_id = ?`, [farmId, incubatorId]);
  const inUse = rows.filter((row) => asDay(row.hatch_on) !== null && (asDay(row.hatch_on) as string) >= today).reduce((sum, row) => sum + (row.eggs_set ?? 0), 0);
  return inUse > machine.capacity;
}

export async function createBatch(actor: Actor, access: FarmAccess, body: unknown) {
  const input = flowBatchInputSchema.parse(body);
  const today = await farmToday(access.farmId);
  if (input.kind === 'existing') {
    assertNotFuture(input.placedOn, today, 'placedOn');
    const shed = await one<ShedRow>(pool, `SELECT id, name, capacity FROM flow_sheds WHERE id = ? AND farm_id = ?`, [input.shedId, access.farmId]);
    if (!shed) throw new AppError(422, 'VALIDATION_ERROR', 'Pick a shed on this farm.', { fields: { shedId: 'invalid_format' } });
    const already = await one<RowDataPacket & { id: string }>(pool, `SELECT id FROM flow_batches WHERE farm_id = ? AND batch_number = 0`, [access.farmId]);
    if (already) throw new AppError(409, 'CONFLICT', 'Batch 0 is already saved.');
    const batchId = randomUUID();
    const moveId = randomUUID();
    await withTransaction(async (conn) => {
      await exec(conn, `INSERT INTO flow_batches (id, farm_id, batch_number, notes, created_by) VALUES (?, ?, 0, ?, ?)`, [batchId, access.farmId, blank(input.notes), actor.user.id]);
      await exec(
        conn,
        `INSERT INTO flow_moves (id, farm_id, batch_id, kind, bird_count, occurred_on, shed_id, reason, notes, created_by) VALUES (?, ?, ?, 'opening', ?, ?, ?, NULL, ?, ?)`,
        [moveId, access.farmId, batchId, input.birdCount, input.placedOn, input.shedId, blank(input.notes), actor.user.id],
      );
      await audit(conn, actor, access.farmId, 'flow_batch.created', 'flow_batch', batchId, { number: 0 });
    });
    return { id: batchId, number: 0, hatchOn: null, capacityWarning: input.birdCount > shed.capacity };
  }
  assertNotFuture(input.setOn, today, 'setOn');
  const machine = await one<IncRow>(pool, `SELECT id, name, capacity FROM flow_incubators WHERE id = ? AND farm_id = ?`, [input.incubatorId, access.farmId]);
  if (!machine) throw new AppError(422, 'VALIDATION_ERROR', 'Pick an incubator on this farm.', { fields: { incubatorId: 'invalid_format' } });
  const max = await one<RowDataPacket & { next_number: number | null }>(pool, `SELECT COALESCE(MAX(batch_number), 0) + 1 AS next_number FROM flow_batches WHERE farm_id = ?`, [access.farmId]);
  const number = asNumber(max?.next_number ?? 1);
  const hatchOn = plusDays(input.setOn, HATCH_LENGTH_DAYS);
  const id = randomUUID();
  await exec(
    pool,
    `INSERT INTO flow_batches (id, farm_id, batch_number, incubator_id, eggs_set, set_on, hatch_on, notes, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, access.farmId, number, input.incubatorId, input.eggsSet, input.setOn, hatchOn, blank(input.notes), actor.user.id],
  );
  await audit(pool, actor, access.farmId, 'flow_batch.created', 'flow_batch', id, { number });
  return { id, number, hatchOn, capacityWarning: await capacityWarning(access.farmId, input.incubatorId, today) };
}

export async function updateBatch(actor: Actor, access: FarmAccess, batchId: string, body: unknown) {
  const input = flowBatchInputSchema.parse(body);
  const batch = await one<BatchRow>(pool, `SELECT id, batch_number, incubator_id, eggs_set, set_on, hatch_on, notes FROM flow_batches WHERE id = ? AND farm_id = ?`, [batchId, access.farmId]);
  if (!batch) throw new AppError(404, 'NOT_FOUND', 'Not found.');
  const today = await farmToday(access.farmId);
  if (input.kind === 'existing') {
    if (batch.batch_number !== 0) throw new AppError(422, 'VALIDATION_ERROR', 'Only Batch 0 holds existing birds.', { fields: { kind: 'invalid_format' } });
    assertNotFuture(input.placedOn, today, 'placedOn');
    const opening = await one<MoveRow>(pool, `SELECT id, batch_id, kind, bird_count, occurred_on, shed_id, from_shed_id, reason, notes FROM flow_moves WHERE batch_id = ? AND kind = 'opening' LIMIT 1`, [batchId]);
    if (!opening) throw new AppError(409, 'CONFLICT', 'Batch 0 has no opening line.');
    await assertBirds(access.farmId, batchId, { ...opening, bird_count: input.birdCount, shed_id: input.shedId, occurred_on: input.placedOn });
    await exec(pool, `UPDATE flow_moves SET bird_count = ?, occurred_on = ?, shed_id = ?, notes = ? WHERE id = ?`, [input.birdCount, input.placedOn, input.shedId, blank(input.notes), opening.id]);
    await exec(pool, `UPDATE flow_batches SET notes = ? WHERE id = ?`, [blank(input.notes), batchId]);
    await audit(pool, actor, access.farmId, 'flow_batch.updated', 'flow_batch', batchId, { number: 0 });
    const shed = await one<ShedRow>(pool, `SELECT id, name, capacity FROM flow_sheds WHERE id = ?`, [input.shedId]);
    return { id: batchId, number: 0, hatchOn: null, capacityWarning: shed ? input.birdCount > shed.capacity : false };
  }
  if (batch.batch_number === 0) throw new AppError(422, 'VALIDATION_ERROR', 'Batch 0 is the existing birds.', { fields: { kind: 'invalid_format' } });
  assertNotFuture(input.setOn, today, 'setOn');
  const hatchOn = plusDays(input.setOn, HATCH_LENGTH_DAYS);
  await exec(pool, `UPDATE flow_batches SET incubator_id = ?, eggs_set = ?, set_on = ?, hatch_on = ?, notes = ? WHERE id = ?`, [
    input.incubatorId,
    input.eggsSet,
    input.setOn,
    hatchOn,
    blank(input.notes),
    batchId,
  ]);
  await audit(pool, actor, access.farmId, 'flow_batch.updated', 'flow_batch', batchId, { number: batch.batch_number });
  return { id: batchId, number: batch.batch_number, hatchOn, capacityWarning: await capacityWarning(access.farmId, input.incubatorId, today) };
}

export async function deleteBatch(actor: Actor, access: FarmAccess, batchId: string) {
  const batch = await one<RowDataPacket & { id: string }>(pool, `SELECT id FROM flow_batches WHERE id = ? AND farm_id = ?`, [batchId, access.farmId]);
  if (!batch) throw new AppError(404, 'NOT_FOUND', 'Not found.');
  await withTransaction(async (conn) => {
    await exec(conn, `DELETE FROM flow_sales WHERE farm_id = ? AND (batch_id = ? OR move_id IN (SELECT id FROM flow_moves WHERE batch_id = ?))`, [access.farmId, batchId, batchId]);
    await exec(conn, `DELETE FROM flow_dose_marks WHERE batch_id = ?`, [batchId]);
    await exec(conn, `DELETE FROM flow_feed_entries WHERE batch_id = ?`, [batchId]);
    await exec(conn, `DELETE FROM flow_hatch_days WHERE batch_id = ?`, [batchId]);
    await exec(conn, `DELETE FROM flow_moves WHERE batch_id = ?`, [batchId]);
    await exec(conn, `DELETE FROM flow_batches WHERE id = ?`, [batchId]);
    await audit(conn, actor, access.farmId, 'flow_batch.deleted', 'flow_batch', batchId, {});
  });
  return { id: batchId };
}

async function assertBirds(farmId: string, batchId: string, candidate: MoveRow) {
  const days = await many<HatchRow>(pool, `SELECT id, batch_id, day_number, live_count FROM flow_hatch_days WHERE batch_id = ?`, [batchId]);
  const moves = await many<MoveRow>(pool, `SELECT id, batch_id, kind, bird_count, occurred_on, shed_id, from_shed_id, reason, notes FROM flow_moves WHERE batch_id = ? AND id <> ?`, [batchId, candidate.id]);
  const live = days.reduce((sum, day) => sum + day.live_count, 0);
  assertPlace(placeOf(live, [...moves, candidate]));
  if (candidate.shed_id) {
    const shed = await one<ShedRow>(pool, `SELECT id, name, capacity FROM flow_sheds WHERE id = ? AND farm_id = ?`, [candidate.shed_id, farmId]);
    if (!shed) throw new AppError(422, 'VALIDATION_ERROR', 'Pick a shed on this farm.', { fields: { shedId: 'invalid_format' } });
  }
  if (candidate.from_shed_id) {
    const shed = await one<ShedRow>(pool, `SELECT id, name, capacity FROM flow_sheds WHERE id = ? AND farm_id = ?`, [candidate.from_shed_id, farmId]);
    if (!shed) throw new AppError(422, 'VALIDATION_ERROR', 'Pick a shed on this farm.', { fields: { fromShedId: 'invalid_format' } });
  }
}

function moveFromInput(id: string, batchId: string, input: ReturnType<typeof flowMoveInputSchema.parse>): MoveRow {
  const reason: Reason | null = input.kind === 'brooding_death' ? 'died' : input.kind === 'exit' ? (input.reason ?? null) : null;
  return {
    constructor: { name: 'RowDataPacket' },
    id,
    batch_id: batchId,
    kind: input.kind,
    bird_count: input.birdCount,
    occurred_on: input.occurredOn,
    shed_id: input.kind === 'brooding_death' ? null : (input.shedId ?? null),
    from_shed_id: input.kind === 'between_sheds' ? (input.fromShedId ?? null) : null,
    reason,
    notes: blank(input.notes),
  } as MoveRow;
}

function checkMove(input: ReturnType<typeof flowMoveInputSchema.parse>) {
  if ((input.kind === 'to_shed' || input.kind === 'exit' || input.kind === 'opening') && !input.shedId) {
    throw new AppError(422, 'VALIDATION_ERROR', 'Pick a shed.', { fields: { shedId: 'too_small' } });
  }
  if (input.kind === 'between_sheds' && (!input.shedId || !input.fromShedId || input.shedId === input.fromShedId)) {
    throw new AppError(422, 'VALIDATION_ERROR', 'Pick two different sheds.', { fields: { shedId: 'invalid_format' } });
  }
  if (input.kind === 'exit' && !input.reason) throw new AppError(422, 'VALIDATION_ERROR', 'Pick a reason.', { fields: { reason: 'too_small' } });
  if (input.kind === 'exit' && input.reason === 'sold' && (!input.buyer || input.quantity === undefined || input.price === undefined)) {
    throw new AppError(422, 'VALIDATION_ERROR', 'A sale needs a buyer, a quantity, and a price.', { fields: { buyer: 'too_small' } });
  }
}

async function writeSale(conn: Db, actor: Actor, farmId: string, moveId: string, batchId: string, input: ReturnType<typeof flowMoveInputSchema.parse>) {
  if (input.kind !== 'exit' || input.reason !== 'sold' || input.quantity === undefined || input.price === undefined) return null;
  const amount = typedAmount(input.quantity, input.price);
  const existing = await one<RowDataPacket & { id: string }>(conn, `SELECT id FROM flow_sales WHERE move_id = ?`, [moveId]);
  if (existing) {
    await exec(conn, `UPDATE flow_sales SET occurred_on = ?, quantity = ?, price = ?, amount = ?, buyer = ?, unit_label = ?, batch_id = ?, notes = ? WHERE id = ?`, [
      input.occurredOn,
      input.quantity,
      input.price,
      amount,
      input.buyer,
      input.unitLabel,
      batchId,
      blank(input.notes),
      existing.id,
    ]);
    return existing.id;
  }
  const id = randomUUID();
  await exec(
    conn,
    `INSERT INTO flow_sales (id, farm_id, occurred_on, kind, quantity, price, amount, buyer, unit_label, batch_id, move_id, notes, created_by) VALUES (?, ?, ?, 'birds', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, farmId, input.occurredOn, input.quantity, input.price, amount, input.buyer, input.unitLabel, batchId, moveId, blank(input.notes), actor.user.id],
  );
  return id;
}

export async function createMove(actor: Actor, access: FarmAccess, body: unknown) {
  const input = flowMoveInputSchema.parse(body);
  checkMove(input);
  const today = await farmToday(access.farmId);
  assertNotFuture(input.occurredOn, today, 'occurredOn');
  const batch = await one<BatchRow>(pool, `SELECT id, batch_number, incubator_id, eggs_set, set_on, hatch_on, notes FROM flow_batches WHERE id = ? AND farm_id = ?`, [input.batchId, access.farmId]);
  if (!batch) throw new AppError(422, 'VALIDATION_ERROR', 'Pick a batch on this farm.', { fields: { batchId: 'invalid_format' } });
  if (input.kind === 'opening' && batch.batch_number !== 0) throw new AppError(422, 'VALIDATION_ERROR', 'Only Batch 0 can open with existing birds.', { fields: { kind: 'invalid_format' } });
  const id = randomUUID();
  const candidate = moveFromInput(id, batch.id, input);
  await assertBirds(access.farmId, batch.id, candidate);
  await withTransaction(async (conn) => {
    await exec(
      conn,
      `INSERT INTO flow_moves (id, farm_id, batch_id, kind, bird_count, occurred_on, shed_id, from_shed_id, reason, notes, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, access.farmId, batch.id, candidate.kind, candidate.bird_count, input.occurredOn, candidate.shed_id, candidate.from_shed_id, candidate.reason, candidate.notes, actor.user.id],
    );
    await writeSale(conn, actor, access.farmId, id, batch.id, input);
    await audit(conn, actor, access.farmId, 'flow_move.created', 'flow_move', id, { kind: input.kind });
  });
  const board = await getFlow(actor, access.farmId);
  const shed = board.sheds.find((item) => item.id === input.shedId);
  return { id, capacityWarning: Boolean(shed?.overCapacity) };
}

export async function updateMove(actor: Actor, access: FarmAccess, moveId: string, body: unknown) {
  const input = flowMoveInputSchema.parse(body);
  checkMove(input);
  const today = await farmToday(access.farmId);
  assertNotFuture(input.occurredOn, today, 'occurredOn');
  const current = await one<MoveRow>(pool, `SELECT id, batch_id, kind, bird_count, occurred_on, shed_id, from_shed_id, reason, notes FROM flow_moves WHERE id = ? AND farm_id = ?`, [moveId, access.farmId]);
  if (!current) throw new AppError(404, 'NOT_FOUND', 'Not found.');
  const candidate = moveFromInput(moveId, input.batchId, input);
  await assertBirds(access.farmId, input.batchId, candidate);
  await withTransaction(async (conn) => {
    await exec(conn, `UPDATE flow_moves SET batch_id = ?, kind = ?, bird_count = ?, occurred_on = ?, shed_id = ?, from_shed_id = ?, reason = ?, notes = ? WHERE id = ?`, [
      input.batchId,
      candidate.kind,
      candidate.bird_count,
      input.occurredOn,
      candidate.shed_id,
      candidate.from_shed_id,
      candidate.reason,
      candidate.notes,
      moveId,
    ]);
    if (input.kind === 'exit' && input.reason === 'sold') await writeSale(conn, actor, access.farmId, moveId, input.batchId, input);
    else await exec(conn, `DELETE FROM flow_sales WHERE move_id = ?`, [moveId]);
    await audit(conn, actor, access.farmId, 'flow_move.updated', 'flow_move', moveId, { kind: input.kind });
  });
  return { id: moveId };
}

export async function deleteMove(actor: Actor, access: FarmAccess, moveId: string) {
  const current = await one<RowDataPacket & { id: string }>(pool, `SELECT id FROM flow_moves WHERE id = ? AND farm_id = ?`, [moveId, access.farmId]);
  if (!current) throw new AppError(404, 'NOT_FOUND', 'Not found.');
  await withTransaction(async (conn) => {
    await exec(conn, `DELETE FROM flow_sales WHERE move_id = ?`, [moveId]);
    await exec(conn, `DELETE FROM flow_moves WHERE id = ?`, [moveId]);
    await audit(conn, actor, access.farmId, 'flow_move.deleted', 'flow_move', moveId, {});
  });
  return { id: moveId };
}

async function ownBatch(farmId: string, batchId: string) {
  const batch = await one<BatchRow>(pool, `SELECT id, batch_number, incubator_id, eggs_set, set_on, hatch_on, notes FROM flow_batches WHERE id = ? AND farm_id = ?`, [batchId, farmId]);
  if (!batch) throw new AppError(422, 'VALIDATION_ERROR', 'Pick a batch on this farm.', { fields: { batchId: 'invalid_format' } });
  return batch;
}

export async function createHatchDay(actor: Actor, access: FarmAccess, batchId: string, body: unknown) {
  const input = flowHatchDayInputSchema.parse(body);
  const batch = await ownBatch(access.farmId, batchId);
  if (batch.batch_number === 0) throw new AppError(422, 'VALIDATION_ERROR', 'Batch 0 does not have hatch days.', { fields: { dayNumber: 'invalid_format' } });
  const id = randomUUID();
  try {
    await exec(pool, `INSERT INTO flow_hatch_days (id, farm_id, batch_id, day_number, live_count, created_by) VALUES (?, ?, ?, ?, ?, ?)`, [
      id,
      access.farmId,
      batchId,
      input.dayNumber,
      input.liveCount,
      actor.user.id,
    ]);
  } catch (error) {
    if (isDup(error)) throw new AppError(409, 'CONFLICT', 'That day is already written.');
    throw error;
  }
  await audit(pool, actor, access.farmId, 'flow_hatch.created', 'flow_hatch_day', id, { day: input.dayNumber });
  return { id };
}

export async function updateHatchDay(actor: Actor, access: FarmAccess, dayId: string, body: unknown) {
  const input = flowHatchDayInputSchema.parse(body);
  const current = await one<HatchRow>(pool, `SELECT id, batch_id, day_number, live_count FROM flow_hatch_days WHERE id = ? AND farm_id = ?`, [dayId, access.farmId]);
  if (!current) throw new AppError(404, 'NOT_FOUND', 'Not found.');
  const days = await many<HatchRow>(pool, `SELECT id, batch_id, day_number, live_count FROM flow_hatch_days WHERE batch_id = ?`, [current.batch_id]);
  const moves = await many<MoveRow>(pool, `SELECT id, batch_id, kind, bird_count, occurred_on, shed_id, from_shed_id, reason, notes FROM flow_moves WHERE batch_id = ?`, [current.batch_id]);
  const live = days.reduce((sum, day) => sum + (day.id === dayId ? input.liveCount : day.live_count), 0);
  assertPlace(placeOf(live, moves));
  try {
    await exec(pool, `UPDATE flow_hatch_days SET day_number = ?, live_count = ? WHERE id = ?`, [input.dayNumber, input.liveCount, dayId]);
  } catch (error) {
    if (isDup(error)) throw new AppError(409, 'CONFLICT', 'That day is already written.');
    throw error;
  }
  await audit(pool, actor, access.farmId, 'flow_hatch.updated', 'flow_hatch_day', dayId, { day: input.dayNumber });
  return { id: dayId };
}

export async function deleteHatchDay(actor: Actor, access: FarmAccess, dayId: string) {
  const current = await one<HatchRow>(pool, `SELECT id, batch_id, day_number, live_count FROM flow_hatch_days WHERE id = ? AND farm_id = ?`, [dayId, access.farmId]);
  if (!current) throw new AppError(404, 'NOT_FOUND', 'Not found.');
  const days = await many<HatchRow>(pool, `SELECT id, batch_id, day_number, live_count FROM flow_hatch_days WHERE batch_id = ? AND id <> ?`, [current.batch_id, dayId]);
  const moves = await many<MoveRow>(pool, `SELECT id, batch_id, kind, bird_count, occurred_on, shed_id, from_shed_id, reason, notes FROM flow_moves WHERE batch_id = ?`, [current.batch_id]);
  const live = days.reduce((sum, day) => sum + day.live_count, 0);
  assertPlace(placeOf(live, moves));
  await exec(pool, `DELETE FROM flow_hatch_days WHERE id = ?`, [dayId]);
  await audit(pool, actor, access.farmId, 'flow_hatch.deleted', 'flow_hatch_day', dayId, {});
  return { id: dayId };
}

export async function createDose(actor: Actor, access: FarmAccess, body: unknown) {
  const input = flowDoseInputSchema.parse(body);
  const today = await farmToday(access.farmId);
  assertNotFuture(input.givenOn, today, 'givenOn');
  await ownBatch(access.farmId, input.batchId);
  const row = await one<RowDataPacket & { id: string }>(pool, `SELECT id FROM schedule_rows WHERE id = ?`, [input.scheduleRowId]);
  if (!row) throw new AppError(422, 'VALIDATION_ERROR', 'That line is not on the paper.', { fields: { scheduleRowId: 'invalid_format' } });
  const id = randomUUID();
  try {
    await exec(pool, `INSERT INTO flow_dose_marks (id, farm_id, batch_id, schedule_row_id, given_on, notes, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)`, [
      id,
      access.farmId,
      input.batchId,
      input.scheduleRowId,
      input.givenOn,
      blank(input.notes),
      actor.user.id,
    ]);
  } catch (error) {
    if (isDup(error)) throw new AppError(409, 'CONFLICT', 'That dose is already marked.');
    throw error;
  }
  await audit(pool, actor, access.farmId, 'flow_dose.created', 'flow_dose_mark', id, {});
  return { id };
}

export async function updateDose(actor: Actor, access: FarmAccess, markId: string, body: unknown) {
  const input = flowDoseInputSchema.parse(body);
  const today = await farmToday(access.farmId);
  assertNotFuture(input.givenOn, today, 'givenOn');
  const result = await exec(pool, `UPDATE flow_dose_marks SET given_on = ?, notes = ? WHERE id = ? AND farm_id = ? AND batch_id = ? AND schedule_row_id = ?`, [
    input.givenOn,
    blank(input.notes),
    markId,
    access.farmId,
    input.batchId,
    input.scheduleRowId,
  ]);
  if (result.affectedRows === 0) throw new AppError(404, 'NOT_FOUND', 'Not found.');
  await audit(pool, actor, access.farmId, 'flow_dose.updated', 'flow_dose_mark', markId, {});
  return { id: markId };
}

export async function deleteDose(actor: Actor, access: FarmAccess, markId: string) {
  const result = await exec(pool, `DELETE FROM flow_dose_marks WHERE id = ? AND farm_id = ?`, [markId, access.farmId]);
  if (result.affectedRows === 0) throw new AppError(404, 'NOT_FOUND', 'Not found.');
  await audit(pool, actor, access.farmId, 'flow_dose.deleted', 'flow_dose_mark', markId, {});
  return { id: markId };
}

export async function createFeed(actor: Actor, access: FarmAccess, body: unknown) {
  const input = flowFeedInputSchema.parse(body);
  const today = await farmToday(access.farmId);
  assertNotFuture(input.occurredOn, today, 'occurredOn');
  const batch = await ownBatch(access.farmId, input.batchId);
  const hatchOn = asDay(batch.hatch_on);
  const age = hatchOn ? ageFromHatch(hatchOn, input.occurredOn) : null;
  const id = randomUUID();
  await exec(
    pool,
    `INSERT INTO flow_feed_entries (id, farm_id, batch_id, occurred_on, age_day, season_label, feed_type, quantity, unit_label, notes, created_by) VALUES (?, ?, ?, ?, ?, 'not_in_source', ?, ?, ?, ?, ?)`,
    [id, access.farmId, input.batchId, input.occurredOn, age, input.feedType, input.quantity, input.unitLabel, blank(input.notes), actor.user.id],
  );
  await audit(pool, actor, access.farmId, 'flow_feed.created', 'flow_feed', id, { feed: input.feedType });
  return { id, ageDay: age, seasonLabel: 'not_in_source' };
}

export async function updateFeed(actor: Actor, access: FarmAccess, feedId: string, body: unknown) {
  const input = flowFeedInputSchema.parse(body);
  const today = await farmToday(access.farmId);
  assertNotFuture(input.occurredOn, today, 'occurredOn');
  const batch = await ownBatch(access.farmId, input.batchId);
  const hatchOn = asDay(batch.hatch_on);
  const age = hatchOn ? ageFromHatch(hatchOn, input.occurredOn) : null;
  const result = await exec(
    pool,
    `UPDATE flow_feed_entries SET batch_id = ?, occurred_on = ?, age_day = ?, feed_type = ?, quantity = ?, unit_label = ?, notes = ? WHERE id = ? AND farm_id = ?`,
    [input.batchId, input.occurredOn, age, input.feedType, input.quantity, input.unitLabel, blank(input.notes), feedId, access.farmId],
  );
  if (result.affectedRows === 0) throw new AppError(404, 'NOT_FOUND', 'Not found.');
  await audit(pool, actor, access.farmId, 'flow_feed.updated', 'flow_feed', feedId, {});
  return { id: feedId };
}

export async function deleteFeed(actor: Actor, access: FarmAccess, feedId: string) {
  const result = await exec(pool, `DELETE FROM flow_feed_entries WHERE id = ? AND farm_id = ?`, [feedId, access.farmId]);
  if (result.affectedRows === 0) throw new AppError(404, 'NOT_FOUND', 'Not found.');
  await audit(pool, actor, access.farmId, 'flow_feed.deleted', 'flow_feed', feedId, {});
  return { id: feedId };
}

export async function createEgg(actor: Actor, access: FarmAccess, body: unknown) {
  const input = flowEggInputSchema.parse(body);
  const today = await farmToday(access.farmId);
  assertNotFuture(input.occurredOn, today, 'occurredOn');
  const id = randomUUID();
  await exec(pool, `INSERT INTO flow_egg_entries (id, farm_id, occurred_on, collected, sold, for_incubator, notes, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [
    id,
    access.farmId,
    input.occurredOn,
    input.collected,
    input.sold,
    input.forIncubator,
    blank(input.notes),
    actor.user.id,
  ]);
  await audit(pool, actor, access.farmId, 'flow_egg.created', 'flow_egg', id, {});
  return { id };
}

export async function updateEgg(actor: Actor, access: FarmAccess, eggId: string, body: unknown) {
  const input = flowEggInputSchema.parse(body);
  const today = await farmToday(access.farmId);
  assertNotFuture(input.occurredOn, today, 'occurredOn');
  const result = await exec(pool, `UPDATE flow_egg_entries SET occurred_on = ?, collected = ?, sold = ?, for_incubator = ?, notes = ? WHERE id = ? AND farm_id = ?`, [
    input.occurredOn,
    input.collected,
    input.sold,
    input.forIncubator,
    blank(input.notes),
    eggId,
    access.farmId,
  ]);
  if (result.affectedRows === 0) throw new AppError(404, 'NOT_FOUND', 'Not found.');
  await audit(pool, actor, access.farmId, 'flow_egg.updated', 'flow_egg', eggId, {});
  return { id: eggId };
}

export async function deleteEgg(actor: Actor, access: FarmAccess, eggId: string) {
  const result = await exec(pool, `DELETE FROM flow_egg_entries WHERE id = ? AND farm_id = ?`, [eggId, access.farmId]);
  if (result.affectedRows === 0) throw new AppError(404, 'NOT_FOUND', 'Not found.');
  await audit(pool, actor, access.farmId, 'flow_egg.deleted', 'flow_egg', eggId, {});
  return { id: eggId };
}

export async function createExpense(actor: Actor, access: FarmAccess, body: unknown) {
  const input = flowExpenseInputSchema.parse(body);
  const today = await farmToday(access.farmId);
  assertNotFuture(input.occurredOn, today, 'occurredOn');
  const id = randomUUID();
  await exec(pool, `INSERT INTO flow_expenses (id, farm_id, occurred_on, category, amount, unit_label, notes, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [
    id,
    access.farmId,
    input.occurredOn,
    input.category,
    input.amount,
    input.unitLabel,
    blank(input.notes),
    actor.user.id,
  ]);
  await audit(pool, actor, access.farmId, 'flow_expense.created', 'flow_expense', id, { category: input.category });
  return { id };
}

export async function updateExpense(actor: Actor, access: FarmAccess, expenseId: string, body: unknown) {
  const input = flowExpenseInputSchema.parse(body);
  const today = await farmToday(access.farmId);
  assertNotFuture(input.occurredOn, today, 'occurredOn');
  const result = await exec(pool, `UPDATE flow_expenses SET occurred_on = ?, category = ?, amount = ?, unit_label = ?, notes = ? WHERE id = ? AND farm_id = ?`, [
    input.occurredOn,
    input.category,
    input.amount,
    input.unitLabel,
    blank(input.notes),
    expenseId,
    access.farmId,
  ]);
  if (result.affectedRows === 0) throw new AppError(404, 'NOT_FOUND', 'Not found.');
  await audit(pool, actor, access.farmId, 'flow_expense.updated', 'flow_expense', expenseId, {});
  return { id: expenseId };
}

export async function deleteExpense(actor: Actor, access: FarmAccess, expenseId: string) {
  const result = await exec(pool, `DELETE FROM flow_expenses WHERE id = ? AND farm_id = ?`, [expenseId, access.farmId]);
  if (result.affectedRows === 0) throw new AppError(404, 'NOT_FOUND', 'Not found.');
  await audit(pool, actor, access.farmId, 'flow_expense.deleted', 'flow_expense', expenseId, {});
  return { id: expenseId };
}

export async function createSale(actor: Actor, access: FarmAccess, body: unknown) {
  const input = flowSaleInputSchema.parse(body);
  const today = await farmToday(access.farmId);
  assertNotFuture(input.occurredOn, today, 'occurredOn');
  if (input.batchId) await ownBatch(access.farmId, input.batchId);
  const id = randomUUID();
  const amount = typedAmount(input.quantity, input.price);
  await exec(
    pool,
    `INSERT INTO flow_sales (id, farm_id, occurred_on, kind, quantity, price, amount, buyer, unit_label, batch_id, notes, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, access.farmId, input.occurredOn, input.kind, input.quantity, input.price, amount, input.buyer, input.unitLabel, input.batchId ?? null, blank(input.notes), actor.user.id],
  );
  await audit(pool, actor, access.farmId, 'flow_sale.created', 'flow_sale', id, { kind: input.kind });
  return { id, amount };
}

export async function updateSale(actor: Actor, access: FarmAccess, saleId: string, body: unknown) {
  const input = flowSaleInputSchema.parse(body);
  const today = await farmToday(access.farmId);
  assertNotFuture(input.occurredOn, today, 'occurredOn');
  if (input.batchId) await ownBatch(access.farmId, input.batchId);
  const amount = typedAmount(input.quantity, input.price);
  const result = await exec(
    pool,
    `UPDATE flow_sales SET occurred_on = ?, kind = ?, quantity = ?, price = ?, amount = ?, buyer = ?, unit_label = ?, batch_id = ?, notes = ? WHERE id = ? AND farm_id = ?`,
    [input.occurredOn, input.kind, input.quantity, input.price, amount, input.buyer, input.unitLabel, input.batchId ?? null, blank(input.notes), saleId, access.farmId],
  );
  if (result.affectedRows === 0) throw new AppError(404, 'NOT_FOUND', 'Not found.');
  await audit(pool, actor, access.farmId, 'flow_sale.updated', 'flow_sale', saleId, {});
  return { id: saleId, amount };
}

export async function deleteSale(actor: Actor, access: FarmAccess, saleId: string) {
  const result = await exec(pool, `DELETE FROM flow_sales WHERE id = ? AND farm_id = ?`, [saleId, access.farmId]);
  if (result.affectedRows === 0) throw new AppError(404, 'NOT_FOUND', 'Not found.');
  await audit(pool, actor, access.farmId, 'flow_sale.deleted', 'flow_sale', saleId, {});
  return { id: saleId };
}

export async function skipBatch0(actor: Actor, access: FarmAccess) {
  await exec(pool, `INSERT INTO flow_setup (farm_id, batch0_skipped) VALUES (?, 1) ON DUPLICATE KEY UPDATE batch0_skipped = 1`, [access.farmId]);
  await audit(pool, actor, access.farmId, 'flow_setup.skipped', 'flow_setup', access.farmId, {});
  return { batch0Skipped: true };
}

