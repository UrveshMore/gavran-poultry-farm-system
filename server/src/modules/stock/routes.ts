import { Router, type Request } from 'express';
import { asyncHandler } from '../../http/asyncHandler.js';
import { sendData } from '../../http/respond.js';
import { currentFarm, currentUser, requireFarmPermission } from '../../middleware/requirePermission.js';
import {
  createItem,
  createMovement,
  createTarget,
  createWater,
  createWeighing,
  getItems,
  getMovements,
  getTargets,
  getWater,
  getWeighings,
} from './service.js';

export const stockRoutes = Router();

function idempotencyOf(req: Request) {
  const header = req.get('idempotency-key');
  return { key: header && header.length > 0 ? header : null, method: req.method, path: req.originalUrl };
}

function actor(req: Request) {
  return { user: currentUser(req), requestId: req.requestId };
}

stockRoutes.get(
  '/:farmId/stock-items',
  ...requireFarmPermission('stock.read'),
  asyncHandler(async (req, res) => {
    sendData(res, 200, await getItems(currentFarm(req).farmId), req.requestId);
  }),
);

stockRoutes.post(
  '/:farmId/stock-items',
  ...requireFarmPermission('stock.manage'),
  asyncHandler(async (req, res) => {
    const result = await createItem(actor(req), currentFarm(req), req.body, idempotencyOf(req));
    sendData(res, result.status, result.data, req.requestId);
  }),
);

stockRoutes.get(
  '/:farmId/stock-movements',
  ...requireFarmPermission('stock.read'),
  asyncHandler(async (req, res) => {
    sendData(res, 200, await getMovements(currentFarm(req).farmId), req.requestId);
  }),
);

stockRoutes.post(
  '/:farmId/stock-movements',
  ...requireFarmPermission('stock.record'),
  asyncHandler(async (req, res) => {
    const result = await createMovement(actor(req), currentFarm(req), req.body, idempotencyOf(req));
    sendData(res, result.status, result.data, req.requestId);
  }),
);

stockRoutes.get(
  '/:farmId/water',
  ...requireFarmPermission('stock.read'),
  asyncHandler(async (req, res) => {
    sendData(res, 200, await getWater(currentFarm(req).farmId), req.requestId);
  }),
);

stockRoutes.post(
  '/:farmId/water',
  ...requireFarmPermission('stock.record'),
  asyncHandler(async (req, res) => {
    const result = await createWater(actor(req), currentFarm(req), req.body, idempotencyOf(req));
    sendData(res, result.status, result.data, req.requestId);
  }),
);

stockRoutes.get(
  '/:farmId/growth-targets',
  ...requireFarmPermission('stock.read'),
  asyncHandler(async (req, res) => {
    sendData(res, 200, await getTargets(currentFarm(req).farmId), req.requestId);
  }),
);

stockRoutes.post(
  '/:farmId/growth-targets',
  ...requireFarmPermission('stock.manage'),
  asyncHandler(async (req, res) => {
    const result = await createTarget(actor(req), currentFarm(req), req.body, idempotencyOf(req));
    sendData(res, result.status, result.data, req.requestId);
  }),
);

stockRoutes.get(
  '/:farmId/weighings',
  ...requireFarmPermission('stock.read'),
  asyncHandler(async (req, res) => {
    sendData(res, 200, await getWeighings(currentFarm(req).farmId), req.requestId);
  }),
);

stockRoutes.post(
  '/:farmId/weighings',
  ...requireFarmPermission('stock.record'),
  asyncHandler(async (req, res) => {
    const result = await createWeighing(actor(req), currentFarm(req), req.body, idempotencyOf(req));
    sendData(res, result.status, result.data, req.requestId);
  }),
);
