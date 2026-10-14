import { Router } from 'express';
import { asyncHandler } from '../../http/asyncHandler.js';
import { sendData } from '../../http/respond.js';
import { currentFarm, currentUser, requireFarmPermission } from '../../middleware/requirePermission.js';
import { getDashboard } from './service.js';

export const dashboardRoutes = Router();

dashboardRoutes.get(
  '/:farmId/dashboard',
  ...requireFarmPermission('farm.read'),
  asyncHandler(async (req, res) => {
    sendData(res, 200, await getDashboard(currentFarm(req), currentUser(req).id), req.requestId);
  }),
);
