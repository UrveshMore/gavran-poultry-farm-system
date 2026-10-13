import { Router, type Request } from 'express';
import { asyncHandler } from '../../http/asyncHandler.js';
import { sendData } from '../../http/respond.js';
import { currentFarm, currentUser, requireFarmPermission } from '../../middleware/requirePermission.js';
import { createBill, createOrder, createPayment, createReceipt, createSupplier, getSuppliers } from './service.js';

export const supplierRoutes = Router();

function idempotencyOf(req: Request) {
  const header = req.get('idempotency-key');
  return { key: header && header.length > 0 ? header : null, method: req.method, path: req.originalUrl };
}
function actor(req: Request) {
  return { user: currentUser(req), requestId: req.requestId };
}

supplierRoutes.get('/:farmId/suppliers', ...requireFarmPermission('supplier.read'), asyncHandler(async (req, res) => {
  sendData(res, 200, await getSuppliers(currentFarm(req).farmId), req.requestId);
}));
supplierRoutes.post('/:farmId/suppliers', ...requireFarmPermission('supplier.record'), asyncHandler(async (req, res) => {
  const result = await createSupplier(actor(req), currentFarm(req), req.body, idempotencyOf(req));
  sendData(res, result.status, result.data, req.requestId);
}));
supplierRoutes.post('/:farmId/purchase-orders', ...requireFarmPermission('supplier.record'), asyncHandler(async (req, res) => {
  const result = await createOrder(actor(req), currentFarm(req), req.body, idempotencyOf(req));
  sendData(res, result.status, result.data, req.requestId);
}));
supplierRoutes.post('/:farmId/goods-receipts', ...requireFarmPermission('supplier.record'), asyncHandler(async (req, res) => {
  const result = await createReceipt(actor(req), currentFarm(req), req.body, idempotencyOf(req));
  sendData(res, result.status, result.data, req.requestId);
}));
supplierRoutes.post('/:farmId/supplier-bills', ...requireFarmPermission('supplier.record'), asyncHandler(async (req, res) => {
  const result = await createBill(actor(req), currentFarm(req), req.body, idempotencyOf(req));
  sendData(res, result.status, result.data, req.requestId);
}));
supplierRoutes.post('/:farmId/supplier-payments', ...requireFarmPermission('supplier.record'), asyncHandler(async (req, res) => {
  const result = await createPayment(actor(req), currentFarm(req), req.body, idempotencyOf(req));
  sendData(res, result.status, result.data, req.requestId);
}));
