import { Router, type Request } from 'express';
import { asyncHandler } from '../../http/asyncHandler.js';
import { sendData } from '../../http/respond.js';
import { currentFarm, currentUser, requireFarmPermission } from '../../middleware/requirePermission.js';
import { searchFarm } from './service.js';

export const searchRoutes = Router();

searchRoutes.get('/:farmId/search', ...requireFarmPermission('farm.read'), asyncHandler(async (req: Request, res) => {
  const q = Array.isArray(req.query.q) ? req.query.q[0] : req.query.q;
  sendData(res, 200, await searchFarm(currentFarm(req), currentUser(req).id, { q }), req.requestId);
}));
