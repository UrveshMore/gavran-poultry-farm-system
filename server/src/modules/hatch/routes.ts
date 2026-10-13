import { Router, type Request } from 'express';
import { AppError } from '../../http/errors.js';
import { asyncHandler } from '../../http/asyncHandler.js';
import { sendData } from '../../http/respond.js';
import { currentFarm, currentUser, requireFarmPermission } from '../../middleware/requirePermission.js';
import { createHatch } from './service.js';

export const hatchRoutes = Router();

function idempotencyOf(req: Request) {
  const header = req.get('idempotency-key');
  return { key: header && header.length > 0 ? header : null, method: req.method, path: req.originalUrl };
}

hatchRoutes.post(
  '/:farmId/incubation/:sittingId/hatches',
  ...requireFarmPermission('hatch.record'),
  asyncHandler(async (req, res) => {
    const sittingId = req.params.sittingId;
    if (typeof sittingId !== 'string') throw new AppError(404, 'NOT_FOUND', 'Not found.');
    const result = await createHatch({ user: currentUser(req), requestId: req.requestId }, currentFarm(req), sittingId, req.body, idempotencyOf(req));
    sendData(res, result.status, result.data, req.requestId);
  }),
);
