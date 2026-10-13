import { Router, type Request } from 'express';
import { asyncHandler } from '../../http/asyncHandler.js';
import { sendData } from '../../http/respond.js';
import { currentFarm, currentUser, requireFarmPermission } from '../../middleware/requirePermission.js';
import { closeOpenBatch, createBatch, createBirdType, createMovement, getBatch, getBatches, getBirdTypes } from './service.js';

export const batchRoutes = Router();

function idempotencyOf(req: Request) {
  const header = req.get('idempotency-key');
  return { key: header && header.length > 0 ? header : null, method: req.method, path: req.originalUrl };
}

function actor(req: Request) {
  return { user: currentUser(req), requestId: req.requestId };
}

function param(value: string | string[] | undefined): string {
  return typeof value === 'string' ? value : '';
}

batchRoutes.get(
  '/:farmId/bird-types',
  ...requireFarmPermission('batch.read'),
  asyncHandler(async (req, res) => {
    sendData(res, 200, await getBirdTypes(currentFarm(req).farmId), req.requestId);
  }),
);

batchRoutes.post(
  '/:farmId/bird-types',
  ...requireFarmPermission('batch.create'),
  asyncHandler(async (req, res) => {
    sendData(res, 201, await createBirdType(actor(req), currentFarm(req), req.body), req.requestId);
  }),
);

batchRoutes.get(
  '/:farmId/batches',
  ...requireFarmPermission('batch.read'),
  asyncHandler(async (req, res) => {
    sendData(res, 200, await getBatches(currentFarm(req).farmId), req.requestId);
  }),
);

batchRoutes.post(
  '/:farmId/batches',
  ...requireFarmPermission('batch.create'),
  asyncHandler(async (req, res) => {
    const result = await createBatch(actor(req), currentFarm(req), req.body, idempotencyOf(req));
    sendData(res, result.status, result.data, req.requestId);
  }),
);

batchRoutes.get(
  '/:farmId/batches/:batchId',
  ...requireFarmPermission('batch.read'),
  asyncHandler(async (req, res) => {
    sendData(res, 200, await getBatch(currentFarm(req).farmId, param(req.params.batchId)), req.requestId);
  }),
);

batchRoutes.post(
  '/:farmId/batches/:batchId/movements',
  ...requireFarmPermission('movement.create'),
  asyncHandler(async (req, res) => {
    const result = await createMovement(actor(req), currentFarm(req), param(req.params.batchId), req.body, idempotencyOf(req));
    sendData(res, result.status, result.data, req.requestId);
  }),
);

batchRoutes.post(
  '/:farmId/batches/:batchId/close',
  ...requireFarmPermission('movement.create'),
  asyncHandler(async (req, res) => {
    sendData(res, 200, await closeOpenBatch(actor(req), currentFarm(req), param(req.params.batchId), req.body), req.requestId);
  }),
);
