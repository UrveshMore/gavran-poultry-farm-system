import { Router, type Request } from 'express';
import { asyncHandler } from '../../http/asyncHandler.js';
import { AppError } from '../../http/errors.js';
import { sendData } from '../../http/respond.js';
import { currentFarm, currentUser, requireFarmPermission } from '../../middleware/requirePermission.js';
import { createBirdEvent, createHatchDay, createLot, createTray, createTraySet, getDesi } from './service.js';

export const desiRoutes = Router();

function actor(req: Request) {
  return { user: currentUser(req), requestId: req.requestId };
}

desiRoutes.get(
  '/:farmId/desi',
  ...requireFarmPermission('farm.read'),
  asyncHandler(async (req, res) => {
    sendData(res, 200, await getDesi(currentFarm(req).farmId), req.requestId);
  }),
);

desiRoutes.post(
  '/:farmId/egg-lots',
  ...requireFarmPermission('egg.record'),
  asyncHandler(async (req, res) => {
    sendData(res, 201, await createLot(actor(req), currentFarm(req), req.body), req.requestId);
  }),
);

desiRoutes.post(
  '/:farmId/trays',
  ...requireFarmPermission('incubator.record'),
  asyncHandler(async (req, res) => {
    sendData(res, 201, await createTray(actor(req), currentFarm(req), req.body), req.requestId);
  }),
);

desiRoutes.post(
  '/:farmId/tray-sets',
  ...requireFarmPermission('incubation.record'),
  asyncHandler(async (req, res) => {
    sendData(res, 201, await createTraySet(actor(req), currentFarm(req), req.body), req.requestId);
  }),
);

desiRoutes.post(
  '/:farmId/tray-sets/:setId/hatches',
  ...requireFarmPermission('hatch.record'),
  asyncHandler(async (req, res) => {
    const setId = req.params.setId;
    if (typeof setId !== 'string') throw new AppError(404, 'NOT_FOUND', 'Not found.');
    sendData(res, 201, await createHatchDay(actor(req), currentFarm(req), setId, req.body), req.requestId);
  }),
);

desiRoutes.post(
  '/:farmId/bird-events',
  ...requireFarmPermission('loss.record'),
  asyncHandler(async (req, res) => {
    sendData(res, 201, await createBirdEvent(actor(req), currentFarm(req), req.body), req.requestId);
  }),
);
