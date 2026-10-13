import { pageSchema } from '@gavran/shared';
import { Router, type Request } from 'express';
import { asyncHandler } from '../../http/asyncHandler.js';
import { sendData } from '../../http/respond.js';
import { authenticate } from '../../middleware/authenticate.js';
import { currentFarm, currentUser, requireFarmPermission } from '../../middleware/requirePermission.js';
import {
  createFarm,
  createShed,
  getAudit,
  getFarm,
  getMembers,
  getSheds,
  inviteMember,
  listMyFarms,
  patchFarm,
  patchMember,
  patchShed,
} from './service.js';

export const farmRoutes = Router();

function idempotencyOf(req: Request) {
  const header = req.get('idempotency-key');
  return {
    key: header && header.length > 0 ? header : null,
    method: req.method,
    path: req.originalUrl,
  };
}

function actor(req: Request) {
  return { user: currentUser(req), requestId: req.requestId };
}

function oneQuery(value: unknown): unknown {
  return Array.isArray(value) ? value[0] : value;
}

farmRoutes.get(
  '/',
  authenticate,
  asyncHandler(async (req, res) => {
    sendData(res, 200, await listMyFarms(currentUser(req).id), req.requestId);
  }),
);

farmRoutes.post(
  '/',
  authenticate,
  asyncHandler(async (req, res) => {
    const result = await createFarm(actor(req), req.body, idempotencyOf(req));
    const status = result.mode === 'replay' ? result.status : result.status;
    const data = result.mode === 'replay' ? result.data : result.data;
    sendData(res, status, data, req.requestId);
  }),
);

farmRoutes.get(
  '/:farmId',
  ...requireFarmPermission('farm.read'),
  asyncHandler(async (req, res) => {
    sendData(res, 200, await getFarm(currentFarm(req)), req.requestId);
  }),
);

farmRoutes.patch(
  '/:farmId',
  ...requireFarmPermission('farm.update'),
  asyncHandler(async (req, res) => {
    sendData(res, 200, await patchFarm(actor(req), currentFarm(req), req.body), req.requestId);
  }),
);

farmRoutes.get(
  '/:farmId/sheds',
  ...requireFarmPermission('shed.read'),
  asyncHandler(async (req, res) => {
    sendData(res, 200, await getSheds(currentFarm(req).farmId), req.requestId);
  }),
);

farmRoutes.post(
  '/:farmId/sheds',
  ...requireFarmPermission('shed.create'),
  asyncHandler(async (req, res) => {
    const result = await createShed(actor(req), currentFarm(req), req.body, idempotencyOf(req));
    sendData(res, result.status, result.data, req.requestId);
  }),
);

farmRoutes.patch(
  '/:farmId/sheds/:shedId',
  ...requireFarmPermission('shed.update'),
  asyncHandler(async (req, res) => {
    const shedId = req.params.shedId;
    if (typeof shedId !== 'string') return;
    sendData(res, 200, await patchShed(actor(req), currentFarm(req), shedId, req.body), req.requestId);
  }),
);

farmRoutes.get(
  '/:farmId/members',
  ...requireFarmPermission('user.read'),
  asyncHandler(async (req, res) => {
    sendData(res, 200, await getMembers(currentFarm(req).farmId), req.requestId);
  }),
);

farmRoutes.post(
  '/:farmId/members',
  ...requireFarmPermission('user.manage'),
  asyncHandler(async (req, res) => {
    const result = await inviteMember(actor(req), currentFarm(req), req.body, idempotencyOf(req));
    sendData(res, result.status, result.data, req.requestId);
  }),
);

farmRoutes.patch(
  '/:farmId/members/:membershipId',
  ...requireFarmPermission('user.manage'),
  asyncHandler(async (req, res) => {
    const membershipId = req.params.membershipId;
    if (typeof membershipId !== 'string') return;
    sendData(res, 200, await patchMember(actor(req), currentFarm(req), membershipId, req.body), req.requestId);
  }),
);

farmRoutes.get(
  '/:farmId/audit',
  ...requireFarmPermission('audit.read'),
  asyncHandler(async (req, res) => {
    const page = pageSchema.parse({ limit: oneQuery(req.query.limit), offset: oneQuery(req.query.offset) });
    sendData(res, 200, await getAudit(currentFarm(req).farmId, page.limit, page.offset), req.requestId);
  }),
);
