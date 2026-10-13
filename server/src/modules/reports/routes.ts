import { Router, type Request } from 'express';
import { asyncHandler } from '../../http/asyncHandler.js';
import { sendData } from '../../http/respond.js';
import { currentFarm, requireFarmPermission } from '../../middleware/requirePermission.js';
import { buildReport } from './service.js';

export const reportRoutes = Router();

function oneQuery(value: unknown): unknown {
  return Array.isArray(value) ? value[0] : value;
}

reportRoutes.get('/:farmId/reports', ...requireFarmPermission('report.read'), asyncHandler(async (req: Request, res) => {
  sendData(res, 200, await buildReport(currentFarm(req).farmId, { from: oneQuery(req.query.from), to: oneQuery(req.query.to) }), req.requestId);
}));
