import { Router, type Request } from 'express';
import { asyncHandler } from '../../http/asyncHandler.js';
import { sendData } from '../../http/respond.js';
import { currentFarm, currentUser, requireFarmPermission } from '../../middleware/requirePermission.js';
import { createCategory, createEntry, getExpenses, reverseEntry } from './service.js';

export const expenseRoutes = Router();

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

expenseRoutes.get('/:farmId/expenses', ...requireFarmPermission('expense.read'), asyncHandler(async (req, res) => {
  sendData(res, 200, await getExpenses(currentFarm(req).farmId), req.requestId);
}));
expenseRoutes.post('/:farmId/expense-categories', ...requireFarmPermission('expense.record'), asyncHandler(async (req, res) => {
  const result = await createCategory(actor(req), currentFarm(req), req.body, idempotencyOf(req));
  sendData(res, result.status, result.data, req.requestId);
}));
expenseRoutes.post('/:farmId/expenses', ...requireFarmPermission('expense.record'), asyncHandler(async (req, res) => {
  const result = await createEntry(actor(req), currentFarm(req), req.body, idempotencyOf(req));
  sendData(res, result.status, result.data, req.requestId);
}));
expenseRoutes.post('/:farmId/expenses/:entryId/reversal', ...requireFarmPermission('expense.record'), asyncHandler(async (req, res) => {
  const result = await reverseEntry(actor(req), currentFarm(req), param(req.params.entryId), req.body, idempotencyOf(req));
  sendData(res, result.status, result.data, req.requestId);
}));
