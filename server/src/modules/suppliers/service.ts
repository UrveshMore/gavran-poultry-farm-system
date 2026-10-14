import { goodsReceiptInputSchema, purchaseOrderInputSchema, supplierBillInputSchema, supplierInputSchema, supplierPaymentInputSchema } from '@gavran/shared';
import { isDup } from '../../db/sql.js';
import { pool } from '../../db/pool.js';
import { withTransaction } from '../../db/transaction.js';
import { AppError } from '../../http/errors.js';
import { finishIdempotency, requestPath, reserveIdempotency } from '../../http/idempotency.js';
import { writeAudit } from '../audit/repository.js';
import type { AuthUser } from '../auth/types.js';
import { todayInTimeZone } from '../batches/service.js';
import type { FarmAccess } from '../farms/access.js';
import { findFarmById } from '../farms/repository.js';
import { insertBill, insertOrder, insertPayment, insertReceipt, insertSupplier, listBills, listOrders, listPayments, listReceipts, listSuppliers, orderOnFarm, supplierOnFarm } from './repository.js';

type Actor = { user: AuthUser; requestId: string };
type IdempotencyInput = { key: string | null; method: string; path: string };

async function farmDay(farmId: string): Promise<string> {
  const farm = await findFarmById(pool, farmId, false);
  if (!farm) throw new AppError(404, 'NOT_FOUND', 'Not found.');
  return todayInTimeZone(farm.timezone);
}

export async function getSuppliers(farmId: string) {
  return {
    suppliers: await listSuppliers(pool, farmId),
    orders: await listOrders(pool, farmId),
    receipts: await listReceipts(pool, farmId),
    bills: await listBills(pool, farmId),
    payments: await listPayments(pool, farmId),
    stockPosting: 'disabled' as const,
    valuation: { status: 'not_chosen' as const, reason: 'decision 7 is open' },
  };
}

export async function createSupplier(actor: Actor, access: FarmAccess, body: unknown, idempotency: IdempotencyInput) {
  const input = supplierInputSchema.parse(body);
  const path = requestPath(idempotency.path);
  try {
    return await withTransaction(async (conn) => {
      const reserved = await reserveIdempotency(conn, { userId: actor.user.id, farmId: access.farmId, key: idempotency.key, method: idempotency.method, path });
      if (reserved.mode === 'replay') return reserved;
      const id = await insertSupplier(conn, { id: '', farmId: access.farmId, name: input.name, contactName: input.contactName, phone: input.phone, notes: input.notes, createdBy: actor.user.id });
      await writeAudit(conn, { farmId: access.farmId, actorUserId: actor.user.id, action: 'supplier.created', entityType: 'supplier', entityId: id, requestId: actor.requestId, summary: { name: input.name } });
      const data = (await listSuppliers(conn, access.farmId)).find((row) => row.id === id);
      if (!data) throw new Error('Supplier insert failed.');
      if (reserved.mode === 'new') await finishIdempotency(conn, reserved.id, 201, data);
      return { mode: 'created' as const, status: 201, data };
    });
  } catch (error) {
    if (isDup(error)) throw new AppError(409, 'DUPLICATE_CODE', 'That supplier name is already used.');
    throw error;
  }
}

export async function createOrder(actor: Actor, access: FarmAccess, body: unknown, idempotency: IdempotencyInput) {
  const input = purchaseOrderInputSchema.parse(body);
  if (!(await supplierOnFarm(pool, access.farmId, input.supplierId))) {
    throw new AppError(422, 'VALIDATION_ERROR', 'Choose a supplier on this farm.', { fields: { supplierId: 'invalid_format' } });
  }
  const path = requestPath(idempotency.path);
  return withTransaction(async (conn) => {
    const reserved = await reserveIdempotency(conn, { userId: actor.user.id, farmId: access.farmId, key: idempotency.key, method: idempotency.method, path });
    if (reserved.mode === 'replay') return reserved;
    const id = await insertOrder(conn, { farmId: access.farmId, supplierId: input.supplierId, orderedOn: input.orderedOn, notes: input.notes, createdBy: actor.user.id, lines: input.lines });
    await writeAudit(conn, { farmId: access.farmId, actorUserId: actor.user.id, action: 'purchase_order.created', entityType: 'purchase_order', entityId: id, requestId: actor.requestId, summary: { status: 'draft' } });
    const data = (await listOrders(conn, access.farmId)).find((row) => row.id === id);
    if (!data) throw new Error('Purchase order insert failed.');
    if (reserved.mode === 'new') await finishIdempotency(conn, reserved.id, 201, data);
    return { mode: 'created' as const, status: 201, data };
  });
}

export async function createReceipt(actor: Actor, access: FarmAccess, body: unknown, idempotency: IdempotencyInput) {
  const input = goodsReceiptInputSchema.parse(body);
  const today = await farmDay(access.farmId);
  if (input.receivedOn > today) throw new AppError(422, 'VALIDATION_ERROR', 'That date is in the future.', { fields: { receivedOn: 'future_date' } });
  if (!(await supplierOnFarm(pool, access.farmId, input.supplierId))) {
    throw new AppError(422, 'VALIDATION_ERROR', 'Choose a supplier on this farm.', { fields: { supplierId: 'invalid_format' } });
  }
  const purchaseOrderId = input.purchaseOrderId === '' ? null : input.purchaseOrderId;
  if (purchaseOrderId && !(await orderOnFarm(pool, access.farmId, purchaseOrderId))) {
    throw new AppError(422, 'VALIDATION_ERROR', 'Choose an order on this farm.', { fields: { purchaseOrderId: 'invalid_format' } });
  }
  const path = requestPath(idempotency.path);
  return withTransaction(async (conn) => {
    const reserved = await reserveIdempotency(conn, { userId: actor.user.id, farmId: access.farmId, key: idempotency.key, method: idempotency.method, path });
    if (reserved.mode === 'replay') return reserved;
    const id = await insertReceipt(conn, {
      farmId: access.farmId, supplierId: input.supplierId, purchaseOrderId, receivedOn: input.receivedOn,
      acceptedQuantity: input.acceptedQuantity, rejectedQuantity: input.rejectedQuantity, unitLabel: input.unitLabel, note: input.note, createdBy: actor.user.id,
    });
    await writeAudit(conn, { farmId: access.farmId, actorUserId: actor.user.id, action: 'goods_receipt.recorded', entityType: 'goods_receipt', entityId: id, requestId: actor.requestId, summary: { acceptedQuantity: input.acceptedQuantity, rejectedQuantity: input.rejectedQuantity } });
    const data = (await listReceipts(conn, access.farmId)).find((row) => row.id === id);
    if (!data) throw new Error('Receipt insert failed.');
    if (reserved.mode === 'new') await finishIdempotency(conn, reserved.id, 201, data);
    return { mode: 'created' as const, status: 201, data };
  });
}

export async function createBill(actor: Actor, access: FarmAccess, body: unknown, idempotency: IdempotencyInput) {
  const input = supplierBillInputSchema.parse(body);
  const today = await farmDay(access.farmId);
  if (input.billedOn > today) throw new AppError(422, 'VALIDATION_ERROR', 'That date is in the future.', { fields: { billedOn: 'future_date' } });
  if (!(await supplierOnFarm(pool, access.farmId, input.supplierId))) {
    throw new AppError(422, 'VALIDATION_ERROR', 'Choose a supplier on this farm.', { fields: { supplierId: 'invalid_format' } });
  }
  const path = requestPath(idempotency.path);
  return withTransaction(async (conn) => {
    const reserved = await reserveIdempotency(conn, { userId: actor.user.id, farmId: access.farmId, key: idempotency.key, method: idempotency.method, path });
    if (reserved.mode === 'replay') return reserved;
    const id = await insertBill(conn, { farmId: access.farmId, ...input, createdBy: actor.user.id });
    await writeAudit(conn, { farmId: access.farmId, actorUserId: actor.user.id, action: 'supplier_bill.recorded', entityType: 'supplier_bill', entityId: id, requestId: actor.requestId, summary: { amount: input.amount, unitLabel: input.unitLabel } });
    const data = (await listBills(conn, access.farmId)).find((row) => row.id === id);
    if (!data) throw new Error('Bill insert failed.');
    if (reserved.mode === 'new') await finishIdempotency(conn, reserved.id, 201, data);
    return { mode: 'created' as const, status: 201, data };
  });
}

export async function createPayment(actor: Actor, access: FarmAccess, body: unknown, idempotency: IdempotencyInput) {
  const input = supplierPaymentInputSchema.parse(body);
  const today = await farmDay(access.farmId);
  if (input.paidOn > today) throw new AppError(422, 'VALIDATION_ERROR', 'That date is in the future.', { fields: { paidOn: 'future_date' } });
  if (!(await supplierOnFarm(pool, access.farmId, input.supplierId))) {
    throw new AppError(422, 'VALIDATION_ERROR', 'Choose a supplier on this farm.', { fields: { supplierId: 'invalid_format' } });
  }
  const path = requestPath(idempotency.path);
  return withTransaction(async (conn) => {
    const reserved = await reserveIdempotency(conn, { userId: actor.user.id, farmId: access.farmId, key: idempotency.key, method: idempotency.method, path });
    if (reserved.mode === 'replay') return reserved;
    const id = await insertPayment(conn, { farmId: access.farmId, ...input, createdBy: actor.user.id });
    await writeAudit(conn, { farmId: access.farmId, actorUserId: actor.user.id, action: 'supplier_payment.recorded', entityType: 'supplier_payment', entityId: id, requestId: actor.requestId, summary: { amount: input.amount, unitLabel: input.unitLabel } });
    const data = (await listPayments(conn, access.farmId)).find((row) => row.id === id);
    if (!data) throw new Error('Payment insert failed.');
    if (reserved.mode === 'new') await finishIdempotency(conn, reserved.id, 201, data);
    return { mode: 'created' as const, status: 201, data };
  });
}
