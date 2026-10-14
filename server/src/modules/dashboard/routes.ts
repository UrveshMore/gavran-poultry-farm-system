import { Router } from 'express';
import { asyncHandler } from '../../http/asyncHandler.js';
import { sendData } from '../../http/respond.js';
import { currentFarm, currentUser, requireFarmPermission } from '../../middleware/requirePermission.js';
import { getDashboard, readPhoneSettings, savePhoneSettings } from './service.js';

export const dashboardRoutes = Router();

dashboardRoutes.get(
  '/:farmId/dashboard',
  ...requireFarmPermission('farm.read'),
  asyncHandler(async (req, res) => {
    sendData(res, 200, await getDashboard(currentFarm(req), currentUser(req).id), req.requestId);
  }),
);

dashboardRoutes.get(
  '/:farmId/phone-alerts',
  ...requireFarmPermission('farm.read'),
  asyncHandler(async (req, res) => {
    const farm = currentFarm(req);
    sendData(res, 200, await readPhoneSettings(farm.farmId, currentUser(req).id), req.requestId);
  }),
);

dashboardRoutes.put(
  '/:farmId/phone-alerts',
  ...requireFarmPermission('farm.read'),
  asyncHandler(async (req, res) => {
    const farm = currentFarm(req);
    sendData(res, 200, await savePhoneSettings(farm.farmId, currentUser(req).id, req.body), req.requestId);
  }),
);
