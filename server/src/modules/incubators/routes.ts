import { Router, type Request } from 'express';
import { AppError } from '../../http/errors.js';
import { asyncHandler } from '../../http/asyncHandler.js';
import { sendData } from '../../http/respond.js';
import { currentFarm, currentUser, requireFarmPermission } from '../../middleware/requirePermission.js';
import { createIncubator, createMaintenance, createReading, getIncubator, getIncubators } from './service.js';

export const incubatorRoutes = Router();

function idempotencyOf(req: Request) {
  const header = req.get('idempotency-key');
  return { key: header && header.length > 0 ? header : null, method: req.method, path: req.originalUrl };
}

function actor(req: Request) {
  return { user: currentUser(req), requestId: req.requestId };
}

function incubatorId(req: Request): string {
  const id = req.params.incubatorId;
  if (typeof id !== 'string') throw new AppError(404, 'NOT_FOUND', 'Not found.');
  return id;
}

incubatorRoutes.get(
  '/:farmId/incubators',
  ...requireFarmPermission('incubator.read'),
  asyncHandler(async (req, res) => {
    sendData(res, 200, await getIncubators(currentFarm(req).farmId), req.requestId);
  }),
);

incubatorRoutes.post(
  '/:farmId/incubators',
  ...requireFarmPermission('incubator.manage'),
  asyncHandler(async (req, res) => {
    const result = await createIncubator(actor(req), currentFarm(req), req.body, idempotencyOf(req));
    sendData(res, result.status, result.data, req.requestId);
  }),
);

incubatorRoutes.get(
  '/:farmId/incubators/:incubatorId',
  ...requireFarmPermission('incubator.read'),
  asyncHandler(async (req, res) => {
    sendData(res, 200, await getIncubator(currentFarm(req).farmId, incubatorId(req)), req.requestId);
  }),
);

incubatorRoutes.post(
  '/:farmId/incubators/:incubatorId/readings',
  ...requireFarmPermission('incubator.record'),
  asyncHandler(async (req, res) => {
    const result = await createReading(actor(req), currentFarm(req), incubatorId(req), req.body, idempotencyOf(req));
    sendData(res, result.status, result.data, req.requestId);
  }),
);

incubatorRoutes.post(
  '/:farmId/incubators/:incubatorId/maintenance',
  ...requireFarmPermission('incubator.manage'),
  asyncHandler(async (req, res) => {
    const result = await createMaintenance(actor(req), currentFarm(req), incubatorId(req), req.body, idempotencyOf(req));
    sendData(res, result.status, result.data, req.requestId);
  }),
);
