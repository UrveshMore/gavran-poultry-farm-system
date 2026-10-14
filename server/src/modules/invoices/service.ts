import { invoiceDocumentInputSchema, saleReturnInputSchema } from '@gavran/shared';
import { pool } from '../../db/pool.js';
import { withTransaction } from '../../db/transaction.js';
import { AppError } from '../../http/errors.js';
import { finishIdempotency, requestPath, reserveIdempotency } from '../../http/idempotency.js';
import { writeAudit } from '../audit/repository.js';
import type { AuthUser } from '../auth/types.js';
import { todayInTimeZone } from '../batches/service.js';
import type { FarmAccess } from '../farms/access.js';
import { findFarmById } from '../farms/repository.js';
import { customerExists } from '../sales/repository.js';
import { documentOnFarm, insertDocument, insertReturn, listDocuments, listReturns, orderOnFarm } from './repository.js';

type Actor = { user: AuthUser; requestId: string };
type IdempotencyInput = { key: string | null; method: string; path: string };

export async function getInvoiceDocuments(farmId: string) {
  return {
    documents: await listDocuments(pool, farmId),
    returns: await listReturns(pool, farmId),
    posting: 'disabled' as const,
    balance: { status: 'not_calculated' as const, reason: 'decision 9 is open' },
  };
}

export async function createInvoiceDocument(actor: Actor, access: FarmAccess, body: unknown, idempotency: IdempotencyInput) {
  const input = invoiceDocumentInputSchema.parse(body);
  const farm = await findFarmById(pool, access.farmId, false);
  if (!farm) throw new AppError(404, 'NOT_FOUND', 'Not found.');
  if (input.issuedOn > todayInTimeZone(farm.timezone)) {
    throw new AppError(422, 'VALIDATION_ERROR', 'That date is in the future.', { fields: { issuedOn: 'future_date' } });
  }
  if (!(await customerExists(pool, access.farmId, input.customerId))) {
    throw new AppError(422, 'VALIDATION_ERROR', 'Choose a customer on this farm.', { fields: { customerId: 'invalid_format' } });
  }
  const orderId = input.orderId === '' ? null : input.orderId;
  if (orderId && !(await orderOnFarm(pool, access.farmId, orderId))) {
    throw new AppError(422, 'VALIDATION_ERROR', 'Choose an order on this farm.', { fields: { orderId: 'invalid_format' } });
  }
  const path = requestPath(idempotency.path);
  return withTransaction(async (conn) => {
    const reserved = await reserveIdempotency(conn, { userId: actor.user.id, farmId: access.farmId, key: idempotency.key, method: idempotency.method, path });
    if (reserved.mode === 'replay') return reserved;
    const id = await insertDocument(conn, { farmId: access.farmId, customerId: input.customerId, orderId, issuedOn: input.issuedOn, notes: input.notes, createdBy: actor.user.id, lines: input.lines });
    await writeAudit(conn, { farmId: access.farmId, actorUserId: actor.user.id, action: 'invoice_document.created', entityType: 'invoice_document', entityId: id, requestId: actor.requestId, summary: { status: 'unposted' } });
    const data = (await listDocuments(conn, access.farmId)).find((row) => row.id === id);
    if (!data) throw new Error('Invoice document insert failed.');
    if (reserved.mode === 'new') await finishIdempotency(conn, reserved.id, 201, data);
    return { mode: 'created' as const, status: 201, data };
  });
}

export async function createSaleReturn(actor: Actor, access: FarmAccess, documentId: string, body: unknown, idempotency: IdempotencyInput) {
  const input = saleReturnInputSchema.parse(body);
  const farm = await findFarmById(pool, access.farmId, false);
  if (!farm) throw new AppError(404, 'NOT_FOUND', 'Not found.');
  if (input.returnedOn > todayInTimeZone(farm.timezone)) {
    throw new AppError(422, 'VALIDATION_ERROR', 'That date is in the future.', { fields: { returnedOn: 'future_date' } });
  }
  if (!(await documentOnFarm(pool, access.farmId, documentId))) throw new AppError(404, 'NOT_FOUND', 'Not found.');
  const path = requestPath(idempotency.path);
  return withTransaction(async (conn) => {
    const reserved = await reserveIdempotency(conn, { userId: actor.user.id, farmId: access.farmId, key: idempotency.key, method: idempotency.method, path });
    if (reserved.mode === 'replay') return reserved;
    const id = await insertReturn(conn, {
      farmId: access.farmId,
      documentId,
      returnedOn: input.returnedOn,
      description: input.description,
      quantity: input.quantity,
      amount: input.amount,
      unitLabel: input.amount === null ? null : input.unitLabel,
      note: input.note,
      createdBy: actor.user.id,
    });
    await writeAudit(conn, { farmId: access.farmId, actorUserId: actor.user.id, action: 'sale_return.recorded', entityType: 'sale_return', entityId: id, requestId: actor.requestId, summary: { documentId } });
    const data = (await listReturns(conn, access.farmId)).find((row) => row.id === id);
    if (!data) throw new Error('Return insert failed.');
    if (reserved.mode === 'new') await finishIdempotency(conn, reserved.id, 201, data);
    return { mode: 'created' as const, status: 201, data };
  });
}
