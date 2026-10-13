import { Router, type Request } from 'express';
import { asyncHandler } from '../../http/asyncHandler.js';
import { sendData } from '../../http/respond.js';
import { currentFarm, currentUser, requireFarmPermission } from '../../middleware/requirePermission.js';
import { createEggCategory, createEggCollection, getEggCategories, getEggCollections } from './service.js';

export const eggRoutes = Router();

function idempotencyOf(req: Request) {
  const header = req.get('idempotency-key');
  return { key: header && header.length > 0 ? header : null, method: req.method, path: req.originalUrl };
}

function actor(req: Request) {
  return { user: currentUser(req), requestId: req.requestId };
}

eggRoutes.get(
  '/:farmId/egg-categories',
  ...requireFarmPermission('egg.read'),
  asyncHandler(async (req, res) => {
    sendData(res, 200, await getEggCategories(currentFarm(req).farmId), req.requestId);
  }),
);

eggRoutes.post(
  '/:farmId/egg-categories',
  ...requireFarmPermission('egg.record'),
  asyncHandler(async (req, res) => {
    sendData(res, 201, await createEggCategory(actor(req), currentFarm(req), req.body), req.requestId);
  }),
);

eggRoutes.get(
  '/:farmId/eggs',
  ...requireFarmPermission('egg.read'),
  asyncHandler(async (req, res) => {
    sendData(res, 200, await getEggCollections(currentFarm(req).farmId), req.requestId);
  }),
);

eggRoutes.post(
  '/:farmId/eggs',
  ...requireFarmPermission('egg.record'),
  asyncHandler(async (req, res) => {
    const result = await createEggCollection(actor(req), currentFarm(req), req.body, idempotencyOf(req));
    sendData(res, result.status, result.data, req.requestId);
  }),
);
