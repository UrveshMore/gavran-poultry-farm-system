import { customerInputSchema, marketPriceInputSchema, orderInputSchema } from '@gavran/shared';
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
import { customerExists, insertCustomer, insertOrder, insertPrice, listCustomers, listOrders, listPrices } from './repository.js';

type Actor = { user: AuthUser; requestId: string };
type IdempotencyInput = { key: string | null; method: string; path: string };

async function today(farmId: string): Promise<string> {
  const farm = await findFarmById(pool, farmId, false);
  if (!farm) throw new AppError(404, 'NOT_FOUND', 'Not found.');
  return todayInTimeZone(farm.timezone);
}

export async function getCustomers(farmId: string) {
  return listCustomers(pool, farmId);
}

export async function createCustomer(actor: Actor, access: FarmAccess, body: unknown, idempotency: IdempotencyInput) {
  const input = customerInputSchema.parse(body);
  const path = requestPath(idempotency.path);
  try {
    return await withTransaction(async (conn) => {
      const reserved = await reserveIdempotency(conn, { userId: actor.user.id, farmId: access.farmId, key: idempotency.key, method: idempotency.method, path });
      if (reserved.mode === 'replay') return reserved;
      const id = await insertCustomer(conn, access.farmId, input.name, input.phone === '' ? null : input.phone, input.notes === '' ? null : input.notes, actor.user.id);
      await writeAudit(conn, { farmId: access.farmId, actorUserId: actor.user.id, action: 'customer.created', entityType: 'customer', entityId: id, requestId: actor.requestId, summary: { name: input.name } });
      const data = (await listCustomers(conn, access.farmId)).find((item) => item.id === id);
      if (!data) throw new Error('Customer insert failed.');
      if (reserved.mode === 'new') await finishIdempotency(conn, reserved.id, 201, data);
      return { mode: 'created' as const, status: 201, data };
    });
  } catch (error) {
    if (isDup(error)) throw new AppError(409, 'DUPLICATE_CODE', 'That customer name is already used.');
    throw error;
  }
}

export async function getPrices(farmId: string) {
  return listPrices(pool, farmId);
}

export async function createPrice(actor: Actor, access: FarmAccess, body: unknown, idempotency: IdempotencyInput) {
  const input = marketPriceInputSchema.parse(body);
  if (input.effectiveOn > (await today(access.farmId))) {
    throw new AppError(422, 'VALIDATION_ERROR', 'That date is in the future.', { fields: { effectiveOn: 'future_date' } });
  }
  const path = requestPath(idempotency.path);
  return withTransaction(async (conn) => {
    const reserved = await reserveIdempotency(conn, { userId: actor.user.id, farmId: access.farmId, key: idempotency.key, method: idempotency.method, path });
    if (reserved.mode === 'replay') return reserved;
    const id = await insertPrice(conn, { farmId: access.farmId, itemName: input.itemName, amount: input.amount, unitLabel: input.unitLabel, effectiveOn: input.effectiveOn, createdBy: actor.user.id });
    await writeAudit(conn, { farmId: access.farmId, actorUserId: actor.user.id, action: 'market_price.recorded', entityType: 'market_price', entityId: id, requestId: actor.requestId, summary: { name: input.itemName } });
    const data = (await listPrices(conn, access.farmId)).find((item) => item.id === id);
    if (!data) throw new Error('Price insert failed.');
    if (reserved.mode === 'new') await finishIdempotency(conn, reserved.id, 201, data);
    return { mode: 'created' as const, status: 201, data };
  });
}

export async function getOrders(farmId: string) {
  return { orders: await listOrders(pool, farmId), invoicePosting: 'disabled' as const };
}

export async function createOrder(actor: Actor, access: FarmAccess, body: unknown, idempotency: IdempotencyInput) {
  const input = orderInputSchema.parse(body);
  if (input.orderedOn > (await today(access.farmId))) {
    throw new AppError(422, 'VALIDATION_ERROR', 'That date is in the future.', { fields: { orderedOn: 'future_date' } });
  }
  const path = requestPath(idempotency.path);
  return withTransaction(async (conn) => {
    const reserved = await reserveIdempotency(conn, { userId: actor.user.id, farmId: access.farmId, key: idempotency.key, method: idempotency.method, path });
    if (reserved.mode === 'replay') return reserved;
    if (!(await customerExists(conn, access.farmId, input.customerId))) {
      throw new AppError(422, 'VALIDATION_ERROR', 'Choose a customer on this farm.', { fields: { customerId: 'invalid_format' } });
    }
    const id = await insertOrder(conn, { farmId: access.farmId, customerId: input.customerId, orderedOn: input.orderedOn, createdBy: actor.user.id, lines: input.lines });
    await writeAudit(conn, { farmId: access.farmId, actorUserId: actor.user.id, action: 'order.drafted', entityType: 'order', entityId: id, requestId: actor.requestId, summary: { lines: input.lines.length } });
    const data = (await listOrders(conn, access.farmId)).find((item) => item.id === id);
    if (!data) throw new Error('Order insert failed.');
    if (reserved.mode === 'new') await finishIdempotency(conn, reserved.id, 201, data);
    return { mode: 'created' as const, status: 201, data };
  });
}

export function refuseInvoice(): never {
  throw new AppError(409, 'INVOICE_POSTING_DISABLED', 'Invoice posting stays off until the farm decides when a sale is posted.');
}
