import { randomUUID } from 'node:crypto';
import type { RowDataPacket } from 'mysql2/promise';
import { asNumber, exec, many, one, type Db } from '../../db/sql.js';

function asDate(value: Date | string): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

export type Supplier = { id: string; name: string; contactName: string; phone: string; notes: string };
export type PurchaseLine = { id: string; description: string; quantity: number; unitLabel: string; unitPrice: number | null; priceUnit: string | null };
export type PurchaseOrder = { id: string; supplierId: string; supplierName: string; orderedOn: string; status: 'draft'; notes: string; lines: PurchaseLine[] };
export type GoodsReceipt = {
  id: string;
  supplierId: string;
  supplierName: string;
  purchaseOrderId: string | null;
  receivedOn: string;
  acceptedQuantity: number;
  rejectedQuantity: number;
  unitLabel: string;
  note: string;
};
export type SupplierMoney = {
  id: string;
  supplierId: string;
  supplierName: string;
  occurredOn: string;
  amount: number;
  unitLabel: string;
  referenceNote: string;
  notes: string;
};

export async function supplierOnFarm(db: Db, farmId: string, supplierId: string): Promise<boolean> {
  const row = await one<RowDataPacket>(db, `SELECT id FROM suppliers WHERE farm_id = ? AND id = ?`, [farmId, supplierId]);
  return Boolean(row);
}

export async function orderOnFarm(db: Db, farmId: string, orderId: string): Promise<boolean> {
  const row = await one<RowDataPacket>(db, `SELECT id FROM purchase_orders WHERE farm_id = ? AND id = ?`, [farmId, orderId]);
  return Boolean(row);
}

export async function listSuppliers(db: Db, farmId: string): Promise<Supplier[]> {
  const rows = await many<RowDataPacket & { id: string; name: string; contact_name: string; phone: string; notes: string }>(
    db,
    `SELECT id, name, contact_name, phone, notes FROM suppliers WHERE farm_id = ? ORDER BY name`,
    [farmId],
  );
  return rows.map((row) => ({ id: row.id, name: row.name, contactName: row.contact_name, phone: row.phone, notes: row.notes }));
}

export async function insertSupplier(db: Db, input: Supplier & { farmId: string; createdBy: string }): Promise<string> {
  const id = randomUUID();
  await exec(
    db,
    `INSERT INTO suppliers (id, farm_id, name, contact_name, phone, notes, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, input.farmId, input.name, input.contactName, input.phone, input.notes, input.createdBy],
  );
  return id;
}

export async function listOrders(db: Db, farmId: string): Promise<PurchaseOrder[]> {
  const orders = await many<RowDataPacket & { id: string; supplier_id: string; supplier_name: string; ordered_on: Date | string; status: 'draft'; notes: string }>(
    db,
    `SELECT o.id, o.supplier_id, s.name AS supplier_name, o.ordered_on, o.status, o.notes
     FROM purchase_orders o JOIN suppliers s ON s.id = o.supplier_id
     WHERE o.farm_id = ? ORDER BY o.ordered_on DESC, o.created_at DESC`,
    [farmId],
  );
  const lines = await many<RowDataPacket & { id: string; order_id: string; description: string; quantity: string; unit_label: string; unit_price: string | null; price_unit: string | null }>(
    db,
    `SELECT l.id, l.order_id, l.description, l.quantity, l.unit_label, l.unit_price, l.price_unit
     FROM purchase_order_lines l JOIN purchase_orders o ON o.id = l.order_id
     WHERE o.farm_id = ? ORDER BY l.description`,
    [farmId],
  );
  return orders.map((order) => ({
    id: order.id,
    supplierId: order.supplier_id,
    supplierName: order.supplier_name,
    orderedOn: asDate(order.ordered_on),
    status: order.status,
    notes: order.notes,
    lines: lines
      .filter((line) => line.order_id === order.id)
      .map((line) => ({
        id: line.id,
        description: line.description,
        quantity: asNumber(line.quantity),
        unitLabel: line.unit_label,
        unitPrice: line.unit_price === null ? null : asNumber(line.unit_price),
        priceUnit: line.price_unit,
      })),
  }));
}

export async function insertOrder(
  db: Db,
  input: { farmId: string; supplierId: string; orderedOn: string; notes: string; createdBy: string; lines: Array<{ description: string; quantity: number; unitLabel: string; unitPrice: number | null; priceUnit: string }> },
): Promise<string> {
  const id = randomUUID();
  await exec(
    db,
    `INSERT INTO purchase_orders (id, farm_id, supplier_id, ordered_on, notes, created_by) VALUES (?, ?, ?, ?, ?, ?)`,
    [id, input.farmId, input.supplierId, input.orderedOn, input.notes, input.createdBy],
  );
  for (const line of input.lines) {
    await exec(
      db,
      `INSERT INTO purchase_order_lines (id, order_id, description, quantity, unit_label, unit_price, price_unit) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [randomUUID(), id, line.description, line.quantity, line.unitLabel, line.unitPrice, line.unitPrice === null ? null : line.priceUnit],
    );
  }
  return id;
}

export async function listReceipts(db: Db, farmId: string): Promise<GoodsReceipt[]> {
  const rows = await many<
    RowDataPacket & {
      id: string;
      supplier_id: string;
      supplier_name: string;
      purchase_order_id: string | null;
      received_on: Date | string;
      accepted_quantity: string;
      rejected_quantity: string;
      unit_label: string;
      note: string;
    }
  >(
    db,
    `SELECT r.id, r.supplier_id, s.name AS supplier_name, r.purchase_order_id, r.received_on,
            r.accepted_quantity, r.rejected_quantity, r.unit_label, r.note
     FROM goods_receipts r JOIN suppliers s ON s.id = r.supplier_id
     WHERE r.farm_id = ? ORDER BY r.received_on DESC, r.created_at DESC`,
    [farmId],
  );
  return rows.map((row) => ({
    id: row.id,
    supplierId: row.supplier_id,
    supplierName: row.supplier_name,
    purchaseOrderId: row.purchase_order_id,
    receivedOn: asDate(row.received_on),
    acceptedQuantity: asNumber(row.accepted_quantity),
    rejectedQuantity: asNumber(row.rejected_quantity),
    unitLabel: row.unit_label,
    note: row.note,
  }));
}

export async function insertReceipt(
  db: Db,
  input: {
    farmId: string;
    supplierId: string;
    purchaseOrderId: string | null;
    receivedOn: string;
    acceptedQuantity: number;
    rejectedQuantity: number;
    unitLabel: string;
    note: string;
    createdBy: string;
  },
): Promise<string> {
  const id = randomUUID();
  await exec(
    db,
    `INSERT INTO goods_receipts
      (id, farm_id, supplier_id, purchase_order_id, received_on, accepted_quantity, rejected_quantity, unit_label, note, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, input.farmId, input.supplierId, input.purchaseOrderId, input.receivedOn, input.acceptedQuantity, input.rejectedQuantity, input.unitLabel, input.note, input.createdBy],
  );
  return id;
}

async function listMoney(db: Db, farmId: string, table: 'supplier_bills' | 'supplier_payments', day: 'billed_on' | 'paid_on'): Promise<SupplierMoney[]> {
  const rows = await many<
    RowDataPacket & {
      id: string;
      supplier_id: string;
      supplier_name: string;
      occurred_on: Date | string;
      amount: string;
      unit_label: string;
      reference_note: string;
      notes: string;
    }
  >(
    db,
    `SELECT m.id, m.supplier_id, s.name AS supplier_name, m.${day} AS occurred_on, m.amount, m.unit_label, m.reference_note, m.notes
     FROM ${table} m JOIN suppliers s ON s.id = m.supplier_id
     WHERE m.farm_id = ? ORDER BY m.${day} DESC, m.created_at DESC`,
    [farmId],
  );
  return rows.map((row) => ({
    id: row.id,
    supplierId: row.supplier_id,
    supplierName: row.supplier_name,
    occurredOn: asDate(row.occurred_on),
    amount: asNumber(row.amount),
    unitLabel: row.unit_label,
    referenceNote: row.reference_note,
    notes: row.notes,
  }));
}

export function listBills(db: Db, farmId: string) {
  return listMoney(db, farmId, 'supplier_bills', 'billed_on');
}
export function listPayments(db: Db, farmId: string) {
  return listMoney(db, farmId, 'supplier_payments', 'paid_on');
}

export async function insertBill(
  db: Db,
  input: { farmId: string; supplierId: string; billedOn: string; amount: number; unitLabel: string; referenceNote: string; notes: string; createdBy: string },
): Promise<string> {
  const id = randomUUID();
  await exec(
    db,
    `INSERT INTO supplier_bills (id, farm_id, supplier_id, billed_on, amount, unit_label, reference_note, notes, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, input.farmId, input.supplierId, input.billedOn, input.amount, input.unitLabel, input.referenceNote, input.notes, input.createdBy],
  );
  return id;
}

export async function insertPayment(
  db: Db,
  input: { farmId: string; supplierId: string; paidOn: string; amount: number; unitLabel: string; referenceNote: string; notes: string; createdBy: string },
): Promise<string> {
  const id = randomUUID();
  await exec(
    db,
    `INSERT INTO supplier_payments (id, farm_id, supplier_id, paid_on, amount, unit_label, reference_note, notes, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, input.farmId, input.supplierId, input.paidOn, input.amount, input.unitLabel, input.referenceNote, input.notes, input.createdBy],
  );
  return id;
}
