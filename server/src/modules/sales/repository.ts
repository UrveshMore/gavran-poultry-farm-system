import { randomUUID } from 'node:crypto';
import type { RowDataPacket } from 'mysql2/promise';
import { asNumber, exec, many, one, type Db } from '../../db/sql.js';

export type Customer = { id: string; name: string; phone: string | null; notes: string | null };
export type MarketPrice = { id: string; itemName: string; amount: number; unitLabel: string; effectiveOn: string };
export type OrderLine = { description: string; quantity: number; unitPrice: number };
export type FarmOrder = {
  id: string;
  customerId: string;
  customerName: string;
  orderedOn: string;
  status: 'draft';
  lines: OrderLine[];
};

function asDate(value: Date | string): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

export async function listCustomers(db: Db, farmId: string): Promise<Customer[]> {
  const rows = await many<RowDataPacket & Customer>(db, `SELECT id, name, phone, notes FROM customers WHERE farm_id = ? ORDER BY name`, [farmId]);
  return rows.map((row) => ({ id: row.id, name: row.name, phone: row.phone, notes: row.notes }));
}

export async function insertCustomer(db: Db, farmId: string, name: string, phone: string | null, notes: string | null, createdBy: string): Promise<string> {
  const id = randomUUID();
  await exec(db, `INSERT INTO customers (id, farm_id, name, phone, notes, created_by) VALUES (?, ?, ?, ?, ?, ?)`, [id, farmId, name, phone, notes, createdBy]);
  return id;
}

export async function listPrices(db: Db, farmId: string): Promise<MarketPrice[]> {
  const rows = await many<RowDataPacket & { id: string; item_name: string; amount: number | string; unit_label: string; effective_on: Date | string }>(
    db,
    `SELECT id, item_name, amount, unit_label, effective_on FROM market_prices WHERE farm_id = ? ORDER BY effective_on DESC, item_name`,
    [farmId],
  );
  return rows.map((row) => ({
    id: row.id,
    itemName: row.item_name,
    amount: asNumber(row.amount),
    unitLabel: row.unit_label,
    effectiveOn: asDate(row.effective_on),
  }));
}

export async function insertPrice(
  db: Db,
  input: { farmId: string; itemName: string; amount: number; unitLabel: string; effectiveOn: string; createdBy: string },
): Promise<string> {
  const id = randomUUID();
  await exec(
    db,
    `INSERT INTO market_prices (id, farm_id, item_name, amount, unit_label, effective_on, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, input.farmId, input.itemName, input.amount, input.unitLabel, input.effectiveOn, input.createdBy],
  );
  return id;
}

export async function customerExists(db: Db, farmId: string, customerId: string): Promise<boolean> {
  const row = await one<RowDataPacket>(db, `SELECT id FROM customers WHERE farm_id = ? AND id = ?`, [farmId, customerId]);
  return Boolean(row);
}

export async function insertOrder(
  db: Db,
  input: { farmId: string; customerId: string; orderedOn: string; createdBy: string; lines: OrderLine[] },
): Promise<string> {
  const id = randomUUID();
  await exec(db, `INSERT INTO orders (id, farm_id, customer_id, ordered_on, created_by) VALUES (?, ?, ?, ?, ?)`, [
    id,
    input.farmId,
    input.customerId,
    input.orderedOn,
    input.createdBy,
  ]);
  for (const line of input.lines) {
    await exec(db, `INSERT INTO order_lines (id, order_id, description, quantity, unit_price) VALUES (?, ?, ?, ?, ?)`, [
      randomUUID(),
      id,
      line.description,
      line.quantity,
      line.unitPrice,
    ]);
  }
  return id;
}

export async function listOrders(db: Db, farmId: string): Promise<FarmOrder[]> {
  const rows = await many<RowDataPacket & { id: string; customer_id: string; customer_name: string; ordered_on: Date | string; status: 'draft' }>(
    db,
    `SELECT o.id, o.customer_id, c.name AS customer_name, o.ordered_on, o.status
     FROM orders o JOIN customers c ON c.id = o.customer_id
     WHERE o.farm_id = ? ORDER BY o.ordered_on DESC, o.created_at DESC LIMIT 50`,
    [farmId],
  );
  if (rows.length === 0) return [];
  const ids = rows.map((row) => row.id);
  const lines = await many<RowDataPacket & { order_id: string; description: string; quantity: number | string; unit_price: number | string }>(
    db,
    `SELECT order_id, description, quantity, unit_price FROM order_lines WHERE order_id IN (${ids.map(() => '?').join(', ')})`,
    ids,
  );
  return rows.map((row) => ({
    id: row.id,
    customerId: row.customer_id,
    customerName: row.customer_name,
    orderedOn: asDate(row.ordered_on),
    status: row.status,
    lines: lines
      .filter((line) => line.order_id === row.id)
      .map((line) => ({ description: line.description, quantity: asNumber(line.quantity), unitPrice: asNumber(line.unit_price) })),
  }));
}
