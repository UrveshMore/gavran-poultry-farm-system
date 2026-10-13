import { randomUUID } from 'node:crypto';
import type { RowDataPacket } from 'mysql2/promise';
import { asNumber, exec, many, one, type Db } from '../../db/sql.js';

function asDate(value: Date | string): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

export type InvoiceLine = { id: string; description: string; quantity: number; unitLabel: string; unitPrice: number | null; priceUnit: string | null };
export type InvoiceDocument = {
  id: string;
  customerId: string;
  customerName: string;
  orderId: string | null;
  issuedOn: string;
  status: 'unposted';
  notes: string;
  lines: InvoiceLine[];
};
export type SaleReturn = {
  id: string;
  documentId: string;
  returnedOn: string;
  description: string;
  quantity: number;
  amount: number | null;
  unitLabel: string | null;
  note: string;
};

export async function orderOnFarm(db: Db, farmId: string, orderId: string): Promise<boolean> {
  const row = await one<RowDataPacket>(db, `SELECT id FROM orders WHERE farm_id = ? AND id = ?`, [farmId, orderId]);
  return Boolean(row);
}

export async function documentOnFarm(db: Db, farmId: string, documentId: string): Promise<boolean> {
  const row = await one<RowDataPacket>(db, `SELECT id FROM invoice_documents WHERE farm_id = ? AND id = ?`, [farmId, documentId]);
  return Boolean(row);
}

export async function listDocuments(db: Db, farmId: string): Promise<InvoiceDocument[]> {
  const docs = await many<RowDataPacket & { id: string; customer_id: string; customer_name: string; order_id: string | null; issued_on: Date | string; status: 'unposted'; notes: string }>(
    db,
    `SELECT d.id, d.customer_id, c.name AS customer_name, d.order_id, d.issued_on, d.status, d.notes
     FROM invoice_documents d JOIN customers c ON c.id = d.customer_id
     WHERE d.farm_id = ? ORDER BY d.issued_on DESC, d.created_at DESC`,
    [farmId],
  );
  const lines = await many<RowDataPacket & { id: string; document_id: string; description: string; quantity: string; unit_label: string; unit_price: string | null; price_unit: string | null }>(
    db,
    `SELECT l.id, l.document_id, l.description, l.quantity, l.unit_label, l.unit_price, l.price_unit
     FROM invoice_lines l JOIN invoice_documents d ON d.id = l.document_id
     WHERE d.farm_id = ? ORDER BY l.description`,
    [farmId],
  );
  return docs.map((doc) => ({
    id: doc.id,
    customerId: doc.customer_id,
    customerName: doc.customer_name,
    orderId: doc.order_id,
    issuedOn: asDate(doc.issued_on),
    status: doc.status,
    notes: doc.notes,
    lines: lines.filter((line) => line.document_id === doc.id).map((line) => ({
      id: line.id,
      description: line.description,
      quantity: asNumber(line.quantity),
      unitLabel: line.unit_label,
      unitPrice: line.unit_price === null ? null : asNumber(line.unit_price),
      priceUnit: line.price_unit,
    })),
  }));
}

export async function insertDocument(
  db: Db,
  input: {
    farmId: string;
    customerId: string;
    orderId: string | null;
    issuedOn: string;
    notes: string;
    createdBy: string;
    lines: Array<{ description: string; quantity: number; unitLabel: string; unitPrice: number | null; priceUnit: string }>;
  },
): Promise<string> {
  const id = randomUUID();
  await exec(
    db,
    `INSERT INTO invoice_documents (id, farm_id, customer_id, order_id, issued_on, notes, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, input.farmId, input.customerId, input.orderId, input.issuedOn, input.notes, input.createdBy],
  );
  for (const line of input.lines) {
    await exec(
      db,
      `INSERT INTO invoice_lines (id, document_id, description, quantity, unit_label, unit_price, price_unit) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [randomUUID(), id, line.description, line.quantity, line.unitLabel, line.unitPrice, line.unitPrice === null ? null : line.priceUnit],
    );
  }
  return id;
}

export async function listReturns(db: Db, farmId: string): Promise<SaleReturn[]> {
  const rows = await many<RowDataPacket & { id: string; document_id: string; returned_on: Date | string; description: string; quantity: string; amount: string | null; unit_label: string | null; note: string }>(
    db,
    `SELECT id, document_id, returned_on, description, quantity, amount, unit_label, note
     FROM sale_returns WHERE farm_id = ? ORDER BY returned_on DESC, created_at DESC`,
    [farmId],
  );
  return rows.map((row) => ({
    id: row.id,
    documentId: row.document_id,
    returnedOn: asDate(row.returned_on),
    description: row.description,
    quantity: asNumber(row.quantity),
    amount: row.amount === null ? null : asNumber(row.amount),
    unitLabel: row.unit_label,
    note: row.note,
  }));
}

export async function insertReturn(
  db: Db,
  input: { farmId: string; documentId: string; returnedOn: string; description: string; quantity: number; amount: number | null; unitLabel: string | null; note: string; createdBy: string },
): Promise<string> {
  const id = randomUUID();
  await exec(
    db,
    `INSERT INTO sale_returns (id, farm_id, document_id, returned_on, description, quantity, amount, unit_label, note, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, input.farmId, input.documentId, input.returnedOn, input.description, input.quantity, input.amount, input.unitLabel, input.note, input.createdBy],
  );
  return id;
}
