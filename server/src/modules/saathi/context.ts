import type { SaathiContext } from '@gavran/shared';
import type { RowDataPacket } from 'mysql2';
import { many } from '../../db/sql.js';
import { pool } from '../../db/pool.js';
import { todayInTimeZone } from '../batches/service.js';
import { medicineToday } from '../doses/service.js';
import type { FarmAccess } from '../farms/access.js';
import { findFarmById } from '../farms/repository.js';

export async function loadContext(access: FarmAccess): Promise<SaathiContext> {
  const farm = await findFarmById(pool, access.farmId, false);
  const today = todayInTimeZone(farm?.timezone ?? 'UTC');
  const [batches, sittings, items, customers, categories, expenseCategories, birdTypes, sheds] = await Promise.all([
    many<RowDataPacket & { id: string; code: string }>(pool, `SELECT id, code FROM batches WHERE farm_id = ? AND status = 'open' ORDER BY code`, [access.farmId]),
    many<RowDataPacket & { id: string; code: string }>(pool, `SELECT id, code FROM incubation_batches WHERE farm_id = ? AND status = 'open' ORDER BY code`, [access.farmId]),
    many<RowDataPacket & { id: string; name: string }>(pool, `SELECT id, name FROM stock_items WHERE farm_id = ? ORDER BY name`, [access.farmId]),
    many<RowDataPacket & { id: string; name: string }>(pool, `SELECT id, name FROM customers WHERE farm_id = ? ORDER BY name`, [access.farmId]),
    many<RowDataPacket & { id: string; name: string }>(pool, `SELECT id, name FROM egg_categories WHERE farm_id = ? AND status = 'active' ORDER BY name`, [access.farmId]),
    many<RowDataPacket & { id: string; name: string }>(pool, `SELECT id, name FROM expense_categories WHERE farm_id = ? ORDER BY name`, [access.farmId]),
    many<RowDataPacket & { id: string; name: string }>(pool, `SELECT id, name FROM bird_types WHERE farm_id = ? AND status = 'active' ORDER BY name`, [access.farmId]),
    many<RowDataPacket & { id: string; code: string }>(pool, `SELECT id, code FROM sheds WHERE farm_id = ? AND status = 'active' ORDER BY code`, [access.farmId]),
  ]);
  const medicine = access.permissions.includes('health.read') ? await medicineToday(access.farmId) : { approved: false as const, groups: [] };
  const doses = medicine.groups.flatMap((group) =>
    group.lines
      .filter((line) => !line.given && line.date === today)
      .map((line) => ({ rowId: line.rowId, batchId: group.batchId, batchCode: group.batchCode, label: line.itemName })),
  );
  return {
    today,
    permissions: access.permissions,
    batches,
    sittings,
    items,
    customers,
    categories,
    expenseCategories,
    birdTypes,
    sheds,
    doses,
  };
}
