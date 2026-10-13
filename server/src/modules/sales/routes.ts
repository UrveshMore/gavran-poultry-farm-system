import { Router, type Request } from 'express';
import { asyncHandler } from '../../http/asyncHandler.js';
import { sendData } from '../../http/respond.js';
import { currentFarm, currentUser, requireFarmPermission } from '../../middleware/requirePermission.js';
import { createCustomer, createOrder, createPrice, getCustomers, getOrders, getPrices, refuseInvoice } from './service.js';

export const saleRoutes = Router();

function idempotencyOf(req: Request) {
  const header = req.get('idempotency-key');
  return { key: header && header.length > 0 ? header : null, method: req.method, path: req.originalUrl };
}
function actor(req: Request) {
  return { user: currentUser(req), requestId: req.requestId };
}

saleRoutes.get('/:farmId/customers', ...requireFarmPermission('sale.read'), asyncHandler(async (req, res) => {
  sendData(res, 200, await getCustomers(currentFarm(req).farmId), req.requestId);
}));
saleRoutes.post('/:farmId/customers', ...requireFarmPermission('sale.record'), asyncHandler(async (req, res) => {
  const result = await createCustomer(actor(req), currentFarm(req), req.body, idempotencyOf(req));
  sendData(res, result.status, result.data, req.requestId);
}));
saleRoutes.get('/:farmId/market-prices', ...requireFarmPermission('sale.read'), asyncHandler(async (req, res) => {
  sendData(res, 200, await getPrices(currentFarm(req).farmId), req.requestId);
}));
saleRoutes.post('/:farmId/market-prices', ...requireFarmPermission('sale.record'), asyncHandler(async (req, res) => {
  const result = await createPrice(actor(req), currentFarm(req), req.body, idempotencyOf(req));
  sendData(res, result.status, result.data, req.requestId);
}));
saleRoutes.get('/:farmId/orders', ...requireFarmPermission('sale.read'), asyncHandler(async (req, res) => {
  sendData(res, 200, await getOrders(currentFarm(req).farmId), req.requestId);
}));
saleRoutes.post('/:farmId/orders', ...requireFarmPermission('sale.record'), asyncHandler(async (req, res) => {
  const result = await createOrder(actor(req), currentFarm(req), req.body, idempotencyOf(req));
  sendData(res, result.status, result.data, req.requestId);
}));
saleRoutes.post('/:farmId/invoices', ...requireFarmPermission('sale.record'), asyncHandler(async () => {
  refuseInvoice();
}));
