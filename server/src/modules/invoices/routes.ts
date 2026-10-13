import { Router, type Request } from 'express';
import { AppError } from '../../http/errors.js';
import { asyncHandler } from '../../http/asyncHandler.js';
import { sendData } from '../../http/respond.js';
import { currentFarm, currentUser, requireFarmPermission } from '../../middleware/requirePermission.js';
import { createInvoiceDocument, createSaleReturn, getInvoiceDocuments } from './service.js';

export const invoiceRoutes = Router();

function idempotencyOf(req: Request) {
  const header = req.get('idempotency-key');
  return { key: header && header.length > 0 ? header : null, method: req.method, path: req.originalUrl };
}
function actor(req: Request) {
  return { user: currentUser(req), requestId: req.requestId };
}
function param(value: string | string[] | undefined): string {
  if (typeof value !== 'string' || value.length === 0) throw new AppError(404, 'NOT_FOUND', 'Not found.');
  return value;
}

invoiceRoutes.get('/:farmId/invoice-documents', ...requireFarmPermission('sale.read'), asyncHandler(async (req, res) => {
  sendData(res, 200, await getInvoiceDocuments(currentFarm(req).farmId), req.requestId);
}));
invoiceRoutes.post('/:farmId/invoice-documents', ...requireFarmPermission('sale.record'), asyncHandler(async (req, res) => {
  const result = await createInvoiceDocument(actor(req), currentFarm(req), req.body, idempotencyOf(req));
  sendData(res, result.status, result.data, req.requestId);
}));
invoiceRoutes.post('/:farmId/invoice-documents/:documentId/returns', ...requireFarmPermission('sale.record'), asyncHandler(async (req, res) => {
  const result = await createSaleReturn(actor(req), currentFarm(req), param(req.params.documentId), req.body, idempotencyOf(req));
  sendData(res, result.status, result.data, req.requestId);
}));
