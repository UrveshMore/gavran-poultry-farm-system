import { Router, type Request } from 'express';
import { AppError } from '../../http/errors.js';
import { asyncHandler } from '../../http/asyncHandler.js';
import { sendData } from '../../http/respond.js';
import { currentFarm, currentUser, requireFarmPermission } from '../../middleware/requirePermission.js';
import { createNotice, getNotices, readNotice } from './service.js';

export const notificationRoutes = Router();

function idempotencyOf(req: Request) {
  const header = req.get('idempotency-key');
  return { key: header && header.length > 0 ? header : null, method: req.method, path: req.originalUrl };
}
function param(value: string | string[] | undefined): string {
  if (typeof value !== 'string' || value.length === 0) throw new AppError(404, 'NOT_FOUND', 'Not found.');
  return value;
}

notificationRoutes.get('/:farmId/notifications', ...requireFarmPermission('notification.read'), asyncHandler(async (req, res) => {
  sendData(res, 200, await getNotices(currentFarm(req), currentUser(req).id), req.requestId);
}));
notificationRoutes.post('/:farmId/notifications', ...requireFarmPermission('notification.write'), asyncHandler(async (req, res) => {
  const result = await createNotice({ user: currentUser(req), requestId: req.requestId }, currentFarm(req), req.body, idempotencyOf(req));
  sendData(res, result.status, result.data, req.requestId);
}));
notificationRoutes.post('/:farmId/notifications/:noticeId/read', ...requireFarmPermission('notification.read'), asyncHandler(async (req, res) => {
  sendData(res, 200, await readNotice({ user: currentUser(req), requestId: req.requestId }, currentFarm(req), param(req.params.noticeId)), req.requestId);
}));
