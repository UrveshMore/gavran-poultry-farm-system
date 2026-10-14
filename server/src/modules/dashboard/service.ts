import type { PermissionCode } from '@gavran/shared';
import { asNumber, many, one, type Db } from '../../db/sql.js';
import { pool } from '../../db/pool.js';
import { AppError } from '../../http/errors.js';
import { todayInTimeZone } from '../batches/service.js';
import { listBatches, listSexCounts } from '../batches/repository.js';
import type { FarmAccess } from '../farms/access.js';
import { findFarmById } from '../farms/repository.js';
import { listItems } from '../stock/repository.js';
import { listTasks } from '../tasks/repository.js';
import type { RowDataPacket } from 'mysql2/promise';

export type AttentionCode =
  | 'no_sheds'
  | 'no_flock'
  | 'eggs_unrecorded'
  | 'overdue_tasks'
  | 'low_stock'
  | 'reorder_not_set'
  | 'unapproved_medicine'
  | 'candling_not_set'
  | 'hatch_day_not_set'
  | 'payments_not_set';

export type AttentionItem = { code: AttentionCode; count: number; path: string };

type MoneySum = { unitLabel: string; amount: number };

function can(access: FarmAccess, code: PermissionCode): boolean {
  return access.permissions.includes(code);
}

function asDay(value: Date | string): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

function shiftDate(iso: string, days: number): string {
  const [year, month, day] = iso.split('-').map(Number);
  const date = new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function money(value: number): number {
  return Math.round(value * 100) / 100;
}

function seesAllTasks(access: FarmAccess): boolean {
  return access.role === 'owner' || access.role === 'manager' || access.role === 'vet_advisor';
}

export async function getDashboard(access: FarmAccess, userId: string) {
  const farm = await findFarmById(pool, access.farmId, false);
  if (!farm) throw new AppError(404, 'NOT_FOUND', 'Not found.');
  const today = todayInTimeZone(farm.timezone);
  const weekStart = shiftDate(today, -6);
  const monthStart = `${today.slice(0, 7)}-01`;
  const attention: AttentionItem[] = [];

  const shedCount = await countSheds(pool, access.farmId);
  if (can(access, 'shed.read') && shedCount === 0) {
    attention.push({ code: 'no_sheds', count: 0, path: 'sheds' });
  }

  const birds = can(access, 'batch.read') ? await birdSection(access.farmId, today) : null;
  if (birds && shedCount > 0 && birds.flocks.length === 0) {
    attention.push({ code: 'no_flock', count: 0, path: 'batches' });
  }

  const eggs = can(access, 'egg.read') ? await eggSection(access.farmId, today, weekStart) : null;
  if (eggs && birds && birds.total > 0 && !eggs.recordedToday) {
    attention.push({ code: 'eggs_unrecorded', count: 0, path: 'eggs' });
  }

  const incubation = can(access, 'incubation.read') ? await incubationSection(access.farmId) : null;
  if (incubation && incubation.openSittings > 0) {
    attention.push({ code: 'hatch_day_not_set', count: incubation.openSittings, path: 'incubation' });
    if (incubation.candlingNotSet > 0) {
      attention.push({ code: 'candling_not_set', count: incubation.candlingNotSet, path: 'incubation' });
    }
  }

  const tasks = can(access, 'task.read') ? await taskSection(access, userId, today) : null;
  if (tasks && tasks.overdue > 0) {
    attention.push({ code: 'overdue_tasks', count: tasks.overdue, path: 'tasks' });
  }

  const health = can(access, 'health.read') || can(access, 'loss.read') ? await healthSection(access, userId, today, weekStart) : null;
  if (health && health.unapprovedMedicine !== null && health.unapprovedMedicine > 0) {
    attention.push({ code: 'unapproved_medicine', count: health.unapprovedMedicine, path: 'health' });
  }

  const stock = can(access, 'stock.read') ? await stockSection(access.farmId) : null;
  if (stock && stock.low.length > 0) {
    attention.push({ code: 'low_stock', count: stock.low.length, path: 'stock' });
  }
  if (stock && stock.reorderNotSet > 0) {
    attention.push({ code: 'reorder_not_set', count: stock.reorderNotSet, path: 'stock' });
  }

  const finance = can(access, 'sale.read') || can(access, 'expense.read') || can(access, 'supplier.read');
  const money = finance ? await moneySection(access, monthStart, today) : null;
  if (money && money.pending.status === 'not_set' && money.pending.billsExist) {
    attention.push({ code: 'payments_not_set', count: money.pending.billCount, path: 'suppliers' });
  }

  return {
    today,
    weekStart,
    monthStart,
    birds,
    eggs,
    incubation,
    tasks,
    health,
    stock,
    money,
    attention,
    alerts: alertRows({ eggs, birds, tasks, health, stock }),
  };
}

function alertRows(input: {
  eggs: { recordedToday: boolean } | null;
  birds: { total: number } | null;
  tasks: { overdue: number } | null;
  health: { vaccines: { overdue: unknown[]; dueToday: unknown[] } } | null;
  stock: { low: unknown[] } | null;
}): Array<{ code: 'care_overdue' | 'care_due' | 'low_stock' | 'task_overdue' | 'eggs_missing'; count: number; path: string }> {
  const rows: Array<{ code: 'care_overdue' | 'care_due' | 'low_stock' | 'task_overdue' | 'eggs_missing'; count: number; path: string }> = [];
  const overdueCare = input.health?.vaccines.overdue.length ?? 0;
  const dueCare = input.health?.vaccines.dueToday.length ?? 0;
  if (overdueCare > 0) rows.push({ code: 'care_overdue', count: overdueCare, path: 'health' });
  if (dueCare > 0) rows.push({ code: 'care_due', count: dueCare, path: 'health' });
  if (input.stock && input.stock.low.length > 0) rows.push({ code: 'low_stock', count: input.stock.low.length, path: 'stock' });
  if (input.tasks && input.tasks.overdue > 0) rows.push({ code: 'task_overdue', count: input.tasks.overdue, path: 'tasks' });
  if (input.eggs && input.birds && input.birds.total > 0 && !input.eggs.recordedToday) {
    rows.push({ code: 'eggs_missing', count: 1, path: 'eggs' });
  }
  return rows;
}

async function countSheds(db: Db, farmId: string): Promise<number> {
  const row = await one<RowDataPacket & { n: number | string }>(db, 'SELECT COUNT(*) AS n FROM sheds WHERE farm_id = ?', [farmId]);
  return asNumber(row?.n ?? 0);
}

function ageDays(hatchDate: string | null, today: string): number | null {
  if (!hatchDate || hatchDate > today) return null;
  return Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${hatchDate}T00:00:00Z`)) / 86_400_000);
}

async function birdSection(farmId: string, today: string) {
  const batches = await listBatches(pool, farmId);
  const sexRows = await listSexCounts(pool, farmId);
  const latestSex = new Map<string, { roosters: number; hens: number; countedOn: string }>();
  for (const row of sexRows) {
    if (!row.batchId || latestSex.has(row.batchId)) continue;
    latestSex.set(row.batchId, { roosters: row.roosterCount, hens: row.henCount, countedOn: row.countedOn });
  }
  const flocks = batches
    .filter((batch) => batch.status === 'open')
    .map((batch) => ({
      id: batch.id,
      code: batch.code,
      liveCount: batch.liveCount,
      hatchDate: batch.hatchDate,
      ageDays: ageDays(batch.hatchDate, today),
      sex: latestSex.get(batch.id) ?? null,
      placements: batch.placements.map((place) => ({ shedName: place.shedName, birdCount: place.birdCount })),
      rangePlacements: batch.rangePlacements.map((place) => ({ name: place.name, birdCount: place.birdCount })),
    }));
  const sheds = new Map<string, { shedName: string; birdCount: number }>();
  for (const batch of batches) {
    if (batch.status !== 'open') continue;
    for (const place of batch.placements) {
      const current = sheds.get(place.shedId) ?? { shedName: place.shedName, birdCount: 0 };
      current.birdCount += place.birdCount;
      sheds.set(place.shedId, current);
    }
  }
  const withSex = flocks.filter((flock) => flock.sex);
  return {
    total: flocks.reduce((sum, flock) => sum + flock.liveCount, 0),
    roosters: withSex.length === 0 ? null : withSex.reduce((sum, flock) => sum + (flock.sex?.roosters ?? 0), 0),
    hens: withSex.length === 0 ? null : withSex.reduce((sum, flock) => sum + (flock.sex?.hens ?? 0), 0),
    sexMissing: flocks.filter((flock) => flock.sex === null).length,
    flocks,
    sheds: [...sheds.values()].sort((a, b) => a.shedName.localeCompare(b.shedName)),
  };
}

async function eggSection(farmId: string, today: string, weekStart: string) {
  const rows = await many<RowDataPacket & { day: Date | string; eggs: number | string }>(
    pool,
    `SELECT c.collected_on AS day, COALESCE(SUM(l.egg_count), 0) AS eggs
     FROM egg_collections c
     JOIN egg_collection_lines l ON l.collection_id = c.id
     WHERE c.farm_id = ? AND c.collected_on >= ? AND c.collected_on <= ?
     GROUP BY c.collected_on`,
    [farmId, weekStart, today],
  );
  const byDay = new Map(rows.map((row) => [asDay(row.day), asNumber(row.eggs)]));
  const days: Array<{ date: string; count: number }> = [];
  for (let offset = -6; offset <= 0; offset += 1) {
    const date = shiftDate(today, offset);
    days.push({ date, count: byDay.get(date) ?? 0 });
  }
  const recorded = await one<RowDataPacket & { n: number | string }>(
    pool,
    'SELECT COUNT(*) AS n FROM egg_collections WHERE farm_id = ? AND collected_on = ?',
    [farmId, today],
  );
  return {
    today: days[days.length - 1]?.count ?? 0,
    recordedToday: asNumber(recorded?.n ?? 0) > 0,
    days,
  };
}

async function incubationSection(farmId: string) {
  const rows = await many<
    RowDataPacket & {
      id: string;
      code: string;
      mode: 'incubator' | 'broody_hen';
      started_on: Date | string;
      egg_count: number | string;
      incubator_name: string | null;
      hen_name: string | null;
      last_candled: Date | string | null;
    }
  >(
    pool,
    `SELECT s.id, s.code, s.mode, s.started_on, s.egg_count, i.name AS incubator_name, s.hen_name,
            (SELECT MAX(c.observed_on) FROM candling_records c WHERE c.incubation_batch_id = s.id) AS last_candled
     FROM incubation_batches s
     LEFT JOIN incubators i ON i.id = s.incubator_id
     WHERE s.farm_id = ? AND s.status = 'open'
     ORDER BY s.started_on, s.code`,
    [farmId],
  );
  const sittings = rows.map((row) => ({
    id: row.id,
    code: row.code,
    mode: row.mode,
    name: row.mode === 'incubator' ? row.incubator_name : row.hen_name,
    startedOn: asDay(row.started_on),
    eggCount: asNumber(row.egg_count),
    daysToCandling: null,
    daysToHatch: null,
    lastCandledOn: row.last_candled ? asDay(row.last_candled) : null,
  }));
  return {
    openSittings: sittings.length,
    candlingNotSet: sittings.filter((sitting) => sitting.lastCandledOn === null).length,
    sittings,
  };
}

async function taskSection(access: FarmAccess, userId: string, today: string) {
  const tasks = await listTasks(pool, access.farmId, seesAllTasks(access) ? null : userId);
  const open = tasks.filter((task) => task.status === 'open' && task.dueOn <= today);
  return {
    dueToday: open.filter((task) => task.dueOn === today).length,
    overdue: open.filter((task) => task.dueOn < today).length,
    items: open.slice(0, 6).map((task) => ({ id: task.id, title: task.title, dueOn: task.dueOn, overdue: task.dueOn < today })),
  };
}

async function healthSection(access: FarmAccess, userId: string, today: string, weekStart: string) {
  const notes = can(access, 'health.read')
    ? await many<RowDataPacket & { id: string; observed_on: Date | string; bird_count: number | string | null; notes: string; batch_code: string | null }>(
        pool,
        `SELECT o.id, o.observed_on, o.bird_count, o.notes, b.code AS batch_code
         FROM health_observations o
         LEFT JOIN batches b ON b.id = o.batch_id
         WHERE o.farm_id = ? AND o.observed_on >= ? AND o.observed_on <= ?
         ORDER BY o.observed_on DESC
         LIMIT 6`,
        [access.farmId, weekStart, today],
      )
    : [];
  const loss = can(access, 'loss.read')
    ? await one<RowDataPacket & { notes: number | string; birds: number | string }>(
        pool,
        `SELECT COUNT(*) AS notes, COALESCE(SUM(bird_count), 0) AS birds
         FROM loss_incidents
         WHERE farm_id = ? AND occurred_on >= ? AND occurred_on <= ?`,
        [access.farmId, weekStart, today],
      )
    : null;
  const unapproved = can(access, 'health.read')
    ? await one<RowDataPacket & { n: number | string }>(
        pool,
        `SELECT COUNT(*) AS n
         FROM knowledge_entries e
         WHERE e.kind = 'medicine'
           AND NOT EXISTS (
             SELECT 1 FROM knowledge_approvals a
             WHERE a.farm_id = ? AND a.entry_id = e.id AND a.approved = 1
           )`,
        [access.farmId],
      )
    : null;
  const assignee = seesAllTasks(access) ? null : userId;
  const vaccines = can(access, 'health.read')
    ? await many<RowDataPacket & { id: string; title: string; due_on: Date | string }>(
        pool,
        `SELECT DISTINCT t.id, t.title, t.due_on
         FROM tasks t
         JOIN audit_logs a ON a.farm_id = t.farm_id AND a.entity_type = 'task' AND a.entity_id = t.id AND a.action = 'health.vaccine_task_created'
         JOIN knowledge_entries e
           ON e.source_file = JSON_UNQUOTE(JSON_EXTRACT(a.summary, '$.sourceFile'))
          AND e.source_page = CAST(JSON_UNQUOTE(JSON_EXTRACT(a.summary, '$.sourcePage')) AS UNSIGNED)
         JOIN knowledge_approvals ap ON ap.farm_id = t.farm_id AND ap.entry_id = e.id AND ap.approved = 1 AND ap.verification_note IS NOT NULL
         WHERE t.farm_id = ? AND t.status = 'open'
           AND (? IS NULL OR t.assignee_user_id = ?)
         ORDER BY t.due_on
         LIMIT 12`,
        [access.farmId, assignee, assignee],
      )
    : [];
  return {
    notes: notes.map((row) => ({
      id: row.id,
      observedOn: asDay(row.observed_on),
      birdCount: row.bird_count === null ? null : asNumber(row.bird_count),
      notes: row.notes,
      batchCode: row.batch_code,
    })),
    losses:
      loss === null
        ? null
        : { notes: asNumber(loss.notes), birds: asNumber(loss.birds), windowDays: 7 },
    unapprovedMedicine: unapproved ? asNumber(unapproved.n) : null,
    vaccines: {
      overdue: vaccines
        .filter((row) => asDay(row.due_on) < today)
        .map((row) => ({ id: row.id, title: row.title, dueOn: asDay(row.due_on) })),
      dueToday: vaccines
        .filter((row) => asDay(row.due_on) === today)
        .map((row) => ({ id: row.id, title: row.title, dueOn: asDay(row.due_on) })),
      upcoming: vaccines
        .filter((row) => asDay(row.due_on) > today)
        .map((row) => ({ id: row.id, title: row.title, dueOn: asDay(row.due_on) })),
    },
  };
}

async function stockSection(farmId: string) {
  const items = await listItems(pool, farmId);
  return {
    medicineShelf: 'not_set' as const,
    reorderNotSet: items.filter((item) => item.reorderLevel === null).length,
    items: items.map((item) => ({
      id: item.id,
      name: item.name,
      unitLabel: item.unitLabel,
      onHand: item.onHand,
      reorderLevel: item.reorderLevel,
      belowReorder: item.belowReorder,
    })),
    low: items
      .filter((item) => item.belowReorder)
      .map((item) => ({ id: item.id, name: item.name, onHand: item.onHand, unitLabel: item.unitLabel, reorderLevel: item.reorderLevel })),
  };
}

async function moneySection(access: FarmAccess, monthStart: string, today: string) {
  const sales = can(access, 'sale.read') ? await salesThisMonth(access.farmId, monthStart, today) : null;
  const expenses = can(access, 'expense.read') ? await expensesThisMonth(access.farmId, monthStart, today) : null;
  const pending = can(access, 'supplier.read') ? await pendingPayments(access.farmId) : { status: 'hidden' as const };
  return { sales, expenses, pending };
}

async function salesThisMonth(farmId: string, monthStart: string, today: string) {
  const row = await one<RowDataPacket & { amount: number | string | null; line_count: number | string }>(
    pool,
    `SELECT COALESCE(SUM(l.quantity * l.unit_price), 0) AS amount, COUNT(l.id) AS line_count
     FROM order_lines l
     JOIN orders o ON o.id = l.order_id
     WHERE o.farm_id = ? AND o.ordered_on >= ? AND o.ordered_on <= ?`,
    [farmId, monthStart, today],
  );
  const lines = asNumber(row?.line_count ?? 0);
  if (lines === 0) return { status: 'not_set' as const, amount: null, unitLabel: null };
  return { status: 'typed' as const, amount: money(asNumber(row?.amount ?? 0)), unitLabel: null };
}

async function expensesThisMonth(farmId: string, monthStart: string, today: string): Promise<MoneySum[]> {
  const rows = await many<RowDataPacket & { unit_label: string; amount: number | string }>(
    pool,
    `SELECT e.unit_label, SUM(e.amount) AS amount
     FROM expense_entries e
     LEFT JOIN expense_entries r ON r.reverses_entry_id = e.id
     WHERE e.farm_id = ? AND e.occurred_on >= ? AND e.occurred_on <= ?
       AND e.direction = 'expense' AND e.reverses_entry_id IS NULL AND r.id IS NULL
     GROUP BY e.unit_label
     ORDER BY e.unit_label`,
    [farmId, monthStart, today],
  );
  return rows.map((row) => ({ unitLabel: row.unit_label, amount: money(asNumber(row.amount)) }));
}

async function pendingPayments(farmId: string) {
  const row = await one<RowDataPacket & { n: number | string }>(
    pool,
    'SELECT COUNT(*) AS n FROM supplier_bills WHERE farm_id = ?',
    [farmId],
  );
  const billCount = asNumber(row?.n ?? 0);
  return { status: 'not_set' as const, billsExist: billCount > 0, billCount };
}
