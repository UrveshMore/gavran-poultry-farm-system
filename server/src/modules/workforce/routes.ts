import { Router, type Request } from 'express';
import { AppError } from '../../http/errors.js';
import { asyncHandler } from '../../http/asyncHandler.js';
import { sendData } from '../../http/respond.js';
import { currentFarm, currentUser, requireFarmPermission } from '../../middleware/requirePermission.js';
import { completeAssignment, createAssignment, createItem, getAttendanceFor, getTraining, linkTaskTraining, recordAttendance } from './service.js';

export const workforceRoutes = Router();

function idempotencyOf(req: Request) {
  const header = req.get('idempotency-key');
  return { key: header && header.length > 0 ? header : null, method: req.method, path: req.originalUrl };
}

function actor(req: Request) {
  return { user: currentUser(req), requestId: req.requestId };
}

function param(value: string | string[] | undefined): string {
  if (typeof value !== 'string' || value.length === 0) throw new AppError(404, 'NOT_FOUND', 'Not found.');
  return value;
}

workforceRoutes.get(
  '/:farmId/attendance',
  ...requireFarmPermission('attendance.read'),
  asyncHandler(async (req, res) => {
    const access = currentFarm(req);
    sendData(res, 200, await getAttendanceFor(access, currentUser(req).id), req.requestId);
  }),
);

workforceRoutes.post(
  '/:farmId/attendance',
  ...requireFarmPermission('attendance.record'),
  asyncHandler(async (req, res) => {
    const result = await recordAttendance(actor(req), currentFarm(req), req.body, idempotencyOf(req));
    sendData(res, result.status, result.data, req.requestId);
  }),
);

workforceRoutes.get(
  '/:farmId/training',
  ...requireFarmPermission('training.read'),
  asyncHandler(async (req, res) => {
    sendData(res, 200, await getTraining(currentFarm(req), currentUser(req).id), req.requestId);
  }),
);

workforceRoutes.post(
  '/:farmId/training-items',
  ...requireFarmPermission('training.manage'),
  asyncHandler(async (req, res) => {
    const result = await createItem(actor(req), currentFarm(req), req.body, idempotencyOf(req));
    sendData(res, result.status, result.data, req.requestId);
  }),
);

workforceRoutes.post(
  '/:farmId/training-assignments',
  ...requireFarmPermission('training.manage'),
  asyncHandler(async (req, res) => {
    const result = await createAssignment(actor(req), currentFarm(req), req.body, idempotencyOf(req));
    sendData(res, result.status, result.data, req.requestId);
  }),
);

workforceRoutes.post(
  '/:farmId/training-assignments/:assignmentId/completion',
  ...requireFarmPermission('training.complete'),
  asyncHandler(async (req, res) => {
    const result = await completeAssignment(actor(req), currentFarm(req), param(req.params.assignmentId), req.body, idempotencyOf(req));
    sendData(res, result.status, result.data, req.requestId);
  }),
);

workforceRoutes.post(
  '/:farmId/tasks/:taskId/training-requirements',
  ...requireFarmPermission('training.manage'),
  asyncHandler(async (req, res) => {
    const result = await linkTaskTraining(actor(req), currentFarm(req), param(req.params.taskId), req.body, idempotencyOf(req));
    sendData(res, result.status, result.data, req.requestId);
  }),
);
