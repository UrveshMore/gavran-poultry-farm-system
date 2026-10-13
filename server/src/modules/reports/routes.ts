import { Router, type Request } from 'express';
import { asyncHandler } from '../../http/asyncHandler.js';
import { sendData } from '../../http/respond.js';
import { currentFarm, requireFarmPermission } from '../../middleware/requirePermission.js';
import { buildReport } from './service.js';

export const reportRoutes = Router();

function oneQuery(value: unknown): unknown {
  return Array.isArray(value) ? value[0] : value;
}

function reportQuery(req: Request) {
  return {
    from: oneQuery(req.query.from),
    to: oneQuery(req.query.to),
    shedId: oneQuery(req.query.shedId),
    batchId: oneQuery(req.query.batchId),
    categoryId: oneQuery(req.query.categoryId),
  };
}

reportRoutes.get('/:farmId/reports/export', ...requireFarmPermission('report.read'), asyncHandler(async (req: Request, res) => {
  res.setHeader('Content-Disposition', 'attachment; filename="gavran-report.json"');
  sendData(res, 200, await buildReport(currentFarm(req).farmId, reportQuery(req)), req.requestId);
}));
reportRoutes.get('/:farmId/reports', ...requireFarmPermission('report.read'), asyncHandler(async (req: Request, res) => {
  sendData(res, 200, await buildReport(currentFarm(req).farmId, reportQuery(req)), req.requestId);
}));
