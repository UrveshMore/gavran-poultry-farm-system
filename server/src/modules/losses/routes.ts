import { Router, type Request } from 'express';
import { asyncHandler } from '../../http/asyncHandler.js';
import { sendData } from '../../http/respond.js';
import { currentFarm, currentUser, requireFarmPermission } from '../../middleware/requirePermission.js';
import { createLoss, getLosses } from './service.js';

export const lossRoutes = Router();

function idempotencyOf(req: Request) {
  const header = req.get('idempotency-key');
  return { key: header && header.length > 0 ? header : null, method: req.method, path: req.originalUrl };
}

lossRoutes.get(
  '/:farmId/losses',
  ...requireFarmPermission('loss.read'),
  asyncHandler(async (req, res) => {
    sendData(res, 200, await getLosses(currentFarm(req).farmId), req.requestId);
  }),
);

lossRoutes.post(
  '/:farmId/losses',
  ...requireFarmPermission('loss.record'),
  asyncHandler(async (req, res) => {
    const result = await createLoss({ user: currentUser(req), requestId: req.requestId }, currentFarm(req), req.body, idempotencyOf(req));
    sendData(res, result.status, result.data, req.requestId);
  }),
);
