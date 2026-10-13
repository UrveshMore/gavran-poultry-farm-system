import { Router, type Request } from 'express';
import { asyncHandler } from '../../http/asyncHandler.js';
import { sendData } from '../../http/respond.js';
import { currentFarm, currentUser, requireFarmPermission } from '../../middleware/requirePermission.js';
import { createParentage, getParentage } from './service.js';

export const parentageRoutes = Router();

function idempotencyOf(req: Request) {
  const header = req.get('idempotency-key');
  return { key: header && header.length > 0 ? header : null, method: req.method, path: req.originalUrl };
}

parentageRoutes.get(
  '/:farmId/parentage',
  ...requireFarmPermission('breeding.read'),
  asyncHandler(async (req, res) => {
    sendData(res, 200, await getParentage(currentFarm(req).farmId), req.requestId);
  }),
);

parentageRoutes.post(
  '/:farmId/parentage',
  ...requireFarmPermission('breeding.record'),
  asyncHandler(async (req, res) => {
    const result = await createParentage({ user: currentUser(req), requestId: req.requestId }, currentFarm(req), req.body, idempotencyOf(req));
    sendData(res, result.status, result.data, req.requestId);
  }),
);
