import { Router, type Request } from 'express';
import { asyncHandler } from '../../http/asyncHandler.js';
import { sendData } from '../../http/respond.js';
import { currentFarm, currentUser, requireFarmPermission } from '../../middleware/requirePermission.js';
import { createYardNote, getYard } from './service.js';

export const yardRoutes = Router();

function idempotencyOf(req: Request) {
  const header = req.get('idempotency-key');
  return { key: header && header.length > 0 ? header : null, method: req.method, path: req.originalUrl };
}

yardRoutes.get(
  '/:farmId/yard-notes',
  ...requireFarmPermission('yard.read'),
  asyncHandler(async (req, res) => {
    sendData(res, 200, await getYard(currentFarm(req).farmId), req.requestId);
  }),
);

yardRoutes.post(
  '/:farmId/yard-notes',
  ...requireFarmPermission('yard.record'),
  asyncHandler(async (req, res) => {
    const result = await createYardNote({ user: currentUser(req), requestId: req.requestId }, currentFarm(req), req.body, idempotencyOf(req));
    sendData(res, result.status, result.data, req.requestId);
  }),
);
