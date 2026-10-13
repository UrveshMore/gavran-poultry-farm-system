import { Router, type Request } from 'express';
import { AppError } from '../../http/errors.js';
import { asyncHandler } from '../../http/asyncHandler.js';
import { sendData } from '../../http/respond.js';
import { currentFarm, currentUser, requireFarmPermission } from '../../middleware/requirePermission.js';
import { createSchedule, getSchedules, runSchedule } from './service.js';

export const scheduleRoutes = Router();

function idempotencyOf(req: Request) {
  const header = req.get('idempotency-key');
  return { key: header && header.length > 0 ? header : null, method: req.method, path: req.originalUrl };
}
function param(value: string | string[] | undefined): string {
  if (typeof value !== 'string' || value.length === 0) throw new AppError(404, 'NOT_FOUND', 'Not found.');
  return value;
}
function actor(req: Request) {
  return { user: currentUser(req), requestId: req.requestId };
}

scheduleRoutes.get('/:farmId/report-schedules', ...requireFarmPermission('report.read'), asyncHandler(async (req, res) => {
  sendData(res, 200, await getSchedules(currentFarm(req).farmId), req.requestId);
}));
scheduleRoutes.post('/:farmId/report-schedules', ...requireFarmPermission('report.read'), asyncHandler(async (req, res) => {
  const result = await createSchedule(actor(req), currentFarm(req), req.body, idempotencyOf(req));
  sendData(res, result.status, result.data, req.requestId);
}));
scheduleRoutes.post('/:farmId/report-schedules/:scheduleId/run', ...requireFarmPermission('report.read'), asyncHandler(async (req, res) => {
  sendData(res, 200, await runSchedule(actor(req), currentFarm(req), param(req.params.scheduleId), req.body), req.requestId);
}));
