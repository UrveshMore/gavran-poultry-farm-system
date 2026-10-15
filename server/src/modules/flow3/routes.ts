import { Router, type Request } from 'express';
import { asyncHandler } from '../../http/asyncHandler.js';
import { AppError } from '../../http/errors.js';
import { sendData } from '../../http/respond.js';
import { currentFarm, currentUser, requireFarmPermission } from '../../middleware/requirePermission.js';
import {
  createBatch,
  createDose,
  createEgg,
  createExpense,
  createFeed,
  createHatchDay,
  createIncubator,
  createMove,
  createSale,
  createShed,
  deleteBatch,
  deleteDose,
  deleteEgg,
  deleteExpense,
  deleteFeed,
  deleteHatchDay,
  deleteIncubator,
  deleteMove,
  deleteSale,
  deleteShed,
  getFlow,
  skipBatch0,
  updateBatch,
  updateDose,
  updateEgg,
  updateExpense,
  updateFeed,
  updateHatchDay,
  updateIncubator,
  updateMove,
  updateSale,
  updateShed,
} from './service.js';

export const flowRoutes = Router();

function actor(req: Request) {
  return { user: currentUser(req), requestId: req.requestId };
}

function id(req: Request, key: string): string {
  const value = req.params[key];
  if (typeof value !== 'string') throw new AppError(404, 'NOT_FOUND', 'Not found.');
  return value;
}

flowRoutes.get(
  '/:farmId/flow',
  ...requireFarmPermission('farm.read'),
  asyncHandler(async (req, res) => {
    sendData(res, 200, await getFlow(actor(req), currentFarm(req).farmId), req.requestId);
  }),
);

flowRoutes.post(
  '/:farmId/flow/setup/skip-batch0',
  ...requireFarmPermission('farm.update'),
  asyncHandler(async (req, res) => {
    sendData(res, 200, await skipBatch0(actor(req), currentFarm(req)), req.requestId);
  }),
);

flowRoutes.post(
  '/:farmId/flow/incubators',
  ...requireFarmPermission('incubator.record'),
  asyncHandler(async (req, res) => {
    sendData(res, 201, await createIncubator(actor(req), currentFarm(req), req.body), req.requestId);
  }),
);
flowRoutes.patch(
  '/:farmId/flow/incubators/:incubatorId',
  ...requireFarmPermission('incubator.manage'),
  asyncHandler(async (req, res) => {
    sendData(res, 200, await updateIncubator(actor(req), currentFarm(req), id(req, 'incubatorId'), req.body), req.requestId);
  }),
);
flowRoutes.delete(
  '/:farmId/flow/incubators/:incubatorId',
  ...requireFarmPermission('incubator.manage'),
  asyncHandler(async (req, res) => {
    sendData(res, 200, await deleteIncubator(actor(req), currentFarm(req), id(req, 'incubatorId')), req.requestId);
  }),
);

flowRoutes.post(
  '/:farmId/flow/sheds',
  ...requireFarmPermission('shed.create'),
  asyncHandler(async (req, res) => {
    sendData(res, 201, await createShed(actor(req), currentFarm(req), req.body), req.requestId);
  }),
);
flowRoutes.patch(
  '/:farmId/flow/sheds/:shedId',
  ...requireFarmPermission('shed.update'),
  asyncHandler(async (req, res) => {
    sendData(res, 200, await updateShed(actor(req), currentFarm(req), id(req, 'shedId'), req.body), req.requestId);
  }),
);
flowRoutes.delete(
  '/:farmId/flow/sheds/:shedId',
  ...requireFarmPermission('shed.update'),
  asyncHandler(async (req, res) => {
    sendData(res, 200, await deleteShed(actor(req), currentFarm(req), id(req, 'shedId')), req.requestId);
  }),
);

flowRoutes.post(
  '/:farmId/flow/batches',
  ...requireFarmPermission('batch.create'),
  asyncHandler(async (req, res) => {
    sendData(res, 201, await createBatch(actor(req), currentFarm(req), req.body), req.requestId);
  }),
);
flowRoutes.patch(
  '/:farmId/flow/batches/:batchId',
  ...requireFarmPermission('batch.create'),
  asyncHandler(async (req, res) => {
    sendData(res, 200, await updateBatch(actor(req), currentFarm(req), id(req, 'batchId'), req.body), req.requestId);
  }),
);
flowRoutes.delete(
  '/:farmId/flow/batches/:batchId',
  ...requireFarmPermission('batch.create'),
  asyncHandler(async (req, res) => {
    sendData(res, 200, await deleteBatch(actor(req), currentFarm(req), id(req, 'batchId')), req.requestId);
  }),
);

flowRoutes.post(
  '/:farmId/flow/batches/:batchId/hatch-days',
  ...requireFarmPermission('hatch.record'),
  asyncHandler(async (req, res) => {
    sendData(res, 201, await createHatchDay(actor(req), currentFarm(req), id(req, 'batchId'), req.body), req.requestId);
  }),
);
flowRoutes.patch(
  '/:farmId/flow/hatch-days/:dayId',
  ...requireFarmPermission('hatch.record'),
  asyncHandler(async (req, res) => {
    sendData(res, 200, await updateHatchDay(actor(req), currentFarm(req), id(req, 'dayId'), req.body), req.requestId);
  }),
);
flowRoutes.delete(
  '/:farmId/flow/hatch-days/:dayId',
  ...requireFarmPermission('hatch.record'),
  asyncHandler(async (req, res) => {
    sendData(res, 200, await deleteHatchDay(actor(req), currentFarm(req), id(req, 'dayId')), req.requestId);
  }),
);

flowRoutes.post(
  '/:farmId/flow/moves',
  ...requireFarmPermission('movement.create'),
  asyncHandler(async (req, res) => {
    sendData(res, 201, await createMove(actor(req), currentFarm(req), req.body), req.requestId);
  }),
);
flowRoutes.patch(
  '/:farmId/flow/moves/:moveId',
  ...requireFarmPermission('movement.create'),
  asyncHandler(async (req, res) => {
    sendData(res, 200, await updateMove(actor(req), currentFarm(req), id(req, 'moveId'), req.body), req.requestId);
  }),
);
flowRoutes.delete(
  '/:farmId/flow/moves/:moveId',
  ...requireFarmPermission('movement.create'),
  asyncHandler(async (req, res) => {
    sendData(res, 200, await deleteMove(actor(req), currentFarm(req), id(req, 'moveId')), req.requestId);
  }),
);

flowRoutes.post(
  '/:farmId/flow/doses',
  ...requireFarmPermission('health.record'),
  asyncHandler(async (req, res) => {
    sendData(res, 201, await createDose(actor(req), currentFarm(req), req.body), req.requestId);
  }),
);
flowRoutes.patch(
  '/:farmId/flow/doses/:markId',
  ...requireFarmPermission('health.record'),
  asyncHandler(async (req, res) => {
    sendData(res, 200, await updateDose(actor(req), currentFarm(req), id(req, 'markId'), req.body), req.requestId);
  }),
);
flowRoutes.delete(
  '/:farmId/flow/doses/:markId',
  ...requireFarmPermission('health.record'),
  asyncHandler(async (req, res) => {
    sendData(res, 200, await deleteDose(actor(req), currentFarm(req), id(req, 'markId')), req.requestId);
  }),
);

flowRoutes.post(
  '/:farmId/flow/feed',
  ...requireFarmPermission('stock.record'),
  asyncHandler(async (req, res) => {
    sendData(res, 201, await createFeed(actor(req), currentFarm(req), req.body), req.requestId);
  }),
);
flowRoutes.patch(
  '/:farmId/flow/feed/:feedId',
  ...requireFarmPermission('stock.record'),
  asyncHandler(async (req, res) => {
    sendData(res, 200, await updateFeed(actor(req), currentFarm(req), id(req, 'feedId'), req.body), req.requestId);
  }),
);
flowRoutes.delete(
  '/:farmId/flow/feed/:feedId',
  ...requireFarmPermission('stock.record'),
  asyncHandler(async (req, res) => {
    sendData(res, 200, await deleteFeed(actor(req), currentFarm(req), id(req, 'feedId')), req.requestId);
  }),
);

flowRoutes.post(
  '/:farmId/flow/eggs',
  ...requireFarmPermission('egg.record'),
  asyncHandler(async (req, res) => {
    sendData(res, 201, await createEgg(actor(req), currentFarm(req), req.body), req.requestId);
  }),
);
flowRoutes.patch(
  '/:farmId/flow/eggs/:eggId',
  ...requireFarmPermission('egg.record'),
  asyncHandler(async (req, res) => {
    sendData(res, 200, await updateEgg(actor(req), currentFarm(req), id(req, 'eggId'), req.body), req.requestId);
  }),
);
flowRoutes.delete(
  '/:farmId/flow/eggs/:eggId',
  ...requireFarmPermission('egg.record'),
  asyncHandler(async (req, res) => {
    sendData(res, 200, await deleteEgg(actor(req), currentFarm(req), id(req, 'eggId')), req.requestId);
  }),
);

flowRoutes.post(
  '/:farmId/flow/expenses',
  ...requireFarmPermission('expense.record'),
  asyncHandler(async (req, res) => {
    sendData(res, 201, await createExpense(actor(req), currentFarm(req), req.body), req.requestId);
  }),
);
flowRoutes.patch(
  '/:farmId/flow/expenses/:expenseId',
  ...requireFarmPermission('expense.record'),
  asyncHandler(async (req, res) => {
    sendData(res, 200, await updateExpense(actor(req), currentFarm(req), id(req, 'expenseId'), req.body), req.requestId);
  }),
);
flowRoutes.delete(
  '/:farmId/flow/expenses/:expenseId',
  ...requireFarmPermission('expense.record'),
  asyncHandler(async (req, res) => {
    sendData(res, 200, await deleteExpense(actor(req), currentFarm(req), id(req, 'expenseId')), req.requestId);
  }),
);

flowRoutes.post(
  '/:farmId/flow/sales',
  ...requireFarmPermission('sale.record'),
  asyncHandler(async (req, res) => {
    sendData(res, 201, await createSale(actor(req), currentFarm(req), req.body), req.requestId);
  }),
);
flowRoutes.patch(
  '/:farmId/flow/sales/:saleId',
  ...requireFarmPermission('sale.record'),
  asyncHandler(async (req, res) => {
    sendData(res, 200, await updateSale(actor(req), currentFarm(req), id(req, 'saleId'), req.body), req.requestId);
  }),
);
flowRoutes.delete(
  '/:farmId/flow/sales/:saleId',
  ...requireFarmPermission('sale.record'),
  asyncHandler(async (req, res) => {
    sendData(res, 200, await deleteSale(actor(req), currentFarm(req), id(req, 'saleId')), req.requestId);
  }),
);
