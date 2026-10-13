import { Router, type Request } from 'express';
import { AppError } from '../../http/errors.js';
import { asyncHandler } from '../../http/asyncHandler.js';
import { sendData } from '../../http/respond.js';
import { currentFarm, currentUser, requireFarmPermission } from '../../middleware/requirePermission.js';
import {
  acceptBiosecurity,
  createBiosecurity,
  createMedicine,
  createObservation,
  createVaccineTask,
  getBiosecurity,
  getEntries,
  getMedicines,
  getObservations,
  setApproval,
} from './service.js';

export const healthRoutes = Router();

function idempotencyOf(req: Request) {
  const header = req.get('idempotency-key');
  return { key: header && header.length > 0 ? header : null, method: req.method, path: req.originalUrl };
}

function actor(req: Request) {
  return { user: currentUser(req), requestId: req.requestId };
}

function entryId(req: Request): string {
  const id = req.params.entryId;
  if (typeof id !== 'string') throw new AppError(404, 'NOT_FOUND', 'Not found.');
  return id;
}

healthRoutes.get(
  '/:farmId/knowledge',
  ...requireFarmPermission('health.read'),
  asyncHandler(async (req, res) => {
    sendData(res, 200, await getEntries(currentFarm(req).farmId), req.requestId);
  }),
);

healthRoutes.post(
  '/:farmId/knowledge/:entryId/approval',
  ...requireFarmPermission('health.approve'),
  asyncHandler(async (req, res) => {
    sendData(res, 200, await setApproval(actor(req), currentFarm(req), entryId(req), req.body), req.requestId);
  }),
);

healthRoutes.post(
  '/:farmId/knowledge/:entryId/vaccine-task',
  ...requireFarmPermission('health.treat'),
  asyncHandler(async (req, res) => {
    const result = await createVaccineTask(actor(req), currentFarm(req), entryId(req), req.body, idempotencyOf(req));
    sendData(res, result.status, result.data, req.requestId);
  }),
);

healthRoutes.get(
  '/:farmId/health-observations',
  ...requireFarmPermission('health.read'),
  asyncHandler(async (req, res) => {
    sendData(res, 200, await getObservations(currentFarm(req).farmId), req.requestId);
  }),
);

healthRoutes.post(
  '/:farmId/health-observations',
  ...requireFarmPermission('health.record'),
  asyncHandler(async (req, res) => {
    const result = await createObservation(actor(req), currentFarm(req), req.body, idempotencyOf(req));
    sendData(res, result.status, result.data, req.requestId);
  }),
);

healthRoutes.get(
  '/:farmId/medicine-records',
  ...requireFarmPermission('health.read'),
  asyncHandler(async (req, res) => {
    sendData(res, 200, await getMedicines(currentFarm(req).farmId), req.requestId);
  }),
);

healthRoutes.post(
  '/:farmId/medicine-records',
  ...requireFarmPermission('health.treat'),
  asyncHandler(async (req, res) => {
    const result = await createMedicine(actor(req), currentFarm(req), req.body, idempotencyOf(req));
    sendData(res, result.status, result.data, req.requestId);
  }),
);

healthRoutes.get(
  '/:farmId/biosecurity-steps',
  ...requireFarmPermission('health.read'),
  asyncHandler(async (req, res) => {
    sendData(res, 200, await getBiosecurity(currentFarm(req).farmId), req.requestId);
  }),
);

healthRoutes.post(
  '/:farmId/biosecurity-steps',
  ...requireFarmPermission('health.record'),
  asyncHandler(async (req, res) => {
    const result = await createBiosecurity(actor(req), currentFarm(req), req.body, idempotencyOf(req));
    sendData(res, result.status, result.data, req.requestId);
  }),
);

healthRoutes.post(
  '/:farmId/biosecurity-steps/:stepId/approve',
  ...requireFarmPermission('health.approve'),
  asyncHandler(async (req, res) => {
    const stepId = req.params.stepId;
    if (typeof stepId !== 'string') throw new AppError(404, 'NOT_FOUND', 'Not found.');
    sendData(res, 200, await acceptBiosecurity(actor(req), currentFarm(req), stepId), req.requestId);
  }),
);
