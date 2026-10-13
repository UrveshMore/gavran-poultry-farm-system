import { Router, type Request } from 'express';
import { AppError } from '../../http/errors.js';
import { asyncHandler } from '../../http/asyncHandler.js';
import { sendData } from '../../http/respond.js';
import { currentFarm, currentUser, requireFarmPermission } from '../../middleware/requirePermission.js';
import { createCandling, createSitting, getSitting, getSittings } from './service.js';

export const incubationRoutes = Router();

function idempotencyOf(req: Request) {
  const header = req.get('idempotency-key');
  return { key: header && header.length > 0 ? header : null, method: req.method, path: req.originalUrl };
}

function actor(req: Request) {
  return { user: currentUser(req), requestId: req.requestId };
}

function sittingId(req: Request): string {
  const id = req.params.sittingId;
  if (typeof id !== 'string') throw new AppError(404, 'NOT_FOUND', 'Not found.');
  return id;
}

incubationRoutes.get(
  '/:farmId/incubation',
  ...requireFarmPermission('incubation.read'),
  asyncHandler(async (req, res) => {
    sendData(res, 200, await getSittings(currentFarm(req).farmId), req.requestId);
  }),
);

incubationRoutes.post(
  '/:farmId/incubation',
  ...requireFarmPermission('incubation.record'),
  asyncHandler(async (req, res) => {
    const result = await createSitting(actor(req), currentFarm(req), req.body, idempotencyOf(req));
    sendData(res, result.status, result.data, req.requestId);
  }),
);

incubationRoutes.get(
  '/:farmId/incubation/:sittingId',
  ...requireFarmPermission('incubation.read'),
  asyncHandler(async (req, res) => {
    sendData(res, 200, await getSitting(currentFarm(req).farmId, sittingId(req)), req.requestId);
  }),
);

incubationRoutes.post(
  '/:farmId/incubation/:sittingId/candling',
  ...requireFarmPermission('incubation.record'),
  asyncHandler(async (req, res) => {
    const result = await createCandling(actor(req), currentFarm(req), sittingId(req), req.body, idempotencyOf(req));
    sendData(res, result.status, result.data, req.requestId);
  }),
);
