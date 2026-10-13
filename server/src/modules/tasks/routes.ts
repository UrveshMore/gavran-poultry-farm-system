import { Router, type Request } from 'express';
import { AppError } from '../../http/errors.js';
import { asyncHandler } from '../../http/asyncHandler.js';
import { sendData } from '../../http/respond.js';
import { currentFarm, currentUser, requireFarmPermission } from '../../middleware/requirePermission.js';
import { addStep, createTask, createTemplate, finishTask, getTask, getTasks, getTemplates, updateStep, updateTemplate } from './service.js';

export const taskRoutes = Router();

function idempotencyOf(req: Request) {
  const header = req.get('idempotency-key');
  return { key: header && header.length > 0 ? header : null, method: req.method, path: req.originalUrl };
}

function actor(req: Request) {
  return { user: currentUser(req), requestId: req.requestId };
}

function idOf(req: Request, name: 'templateId' | 'stepId' | 'taskId'): string {
  const id = req.params[name];
  if (typeof id !== 'string') throw new AppError(404, 'NOT_FOUND', 'Not found.');
  return id;
}

taskRoutes.get(
  '/:farmId/task-templates',
  ...requireFarmPermission('task.read'),
  asyncHandler(async (req, res) => {
    sendData(res, 200, await getTemplates(currentFarm(req).farmId), req.requestId);
  }),
);

taskRoutes.post(
  '/:farmId/task-templates',
  ...requireFarmPermission('task.manage'),
  asyncHandler(async (req, res) => {
    const result = await createTemplate(actor(req), currentFarm(req), req.body, idempotencyOf(req));
    sendData(res, result.status, result.data, req.requestId);
  }),
);

taskRoutes.patch(
  '/:farmId/task-templates/:templateId',
  ...requireFarmPermission('task.manage'),
  asyncHandler(async (req, res) => {
    sendData(res, 200, await updateTemplate(actor(req), currentFarm(req), idOf(req, 'templateId'), req.body), req.requestId);
  }),
);

taskRoutes.post(
  '/:farmId/task-templates/:templateId/steps',
  ...requireFarmPermission('task.manage'),
  asyncHandler(async (req, res) => {
    const result = await addStep(actor(req), currentFarm(req), idOf(req, 'templateId'), req.body, idempotencyOf(req));
    sendData(res, result.status, result.data, req.requestId);
  }),
);

taskRoutes.patch(
  '/:farmId/task-templates/:templateId/steps/:stepId',
  ...requireFarmPermission('task.manage'),
  asyncHandler(async (req, res) => {
    sendData(
      res,
      200,
      await updateStep(actor(req), currentFarm(req), idOf(req, 'templateId'), idOf(req, 'stepId'), req.body),
      req.requestId,
    );
  }),
);

taskRoutes.get(
  '/:farmId/tasks',
  ...requireFarmPermission('task.read'),
  asyncHandler(async (req, res) => {
    const user = currentUser(req);
    sendData(res, 200, await getTasks(currentFarm(req), user.id), req.requestId);
  }),
);

taskRoutes.post(
  '/:farmId/tasks',
  ...requireFarmPermission('task.manage'),
  asyncHandler(async (req, res) => {
    const result = await createTask(actor(req), currentFarm(req), req.body, idempotencyOf(req));
    sendData(res, result.status, result.data, req.requestId);
  }),
);

taskRoutes.get(
  '/:farmId/tasks/:taskId',
  ...requireFarmPermission('task.read'),
  asyncHandler(async (req, res) => {
    const user = currentUser(req);
    sendData(res, 200, await getTask(currentFarm(req), user.id, idOf(req, 'taskId')), req.requestId);
  }),
);

taskRoutes.post(
  '/:farmId/tasks/:taskId/complete',
  ...requireFarmPermission('task.complete'),
  asyncHandler(async (req, res) => {
    const result = await finishTask(actor(req), currentFarm(req), idOf(req, 'taskId'), req.body, idempotencyOf(req));
    sendData(res, result.status, result.data, req.requestId);
  }),
);
