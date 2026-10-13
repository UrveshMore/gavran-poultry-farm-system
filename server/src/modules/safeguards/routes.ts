import { Router } from 'express';
import { asyncHandler } from '../../http/asyncHandler.js';
import { sendData } from '../../http/respond.js';
import { requireFarmPermission } from '../../middleware/requirePermission.js';

export const safeguardRoutes = Router();

safeguardRoutes.get('/:farmId/safeguards', ...requireFarmPermission('farm.read'), asyncHandler(async (req, res) => {
  sendData(res, 200, {
    retention: { status: 'not_chosen', reason: 'decision 15 is open' },
    recovery: { rpo: null, rto: null, reason: 'decision 12 is open' },
    backup: {
      schedule: 'not_chosen',
      offsiteCopy: 'not_chosen',
      isolatedDatabase: 'gavran_restore_drill',
    },
  }, req.requestId);
}));
