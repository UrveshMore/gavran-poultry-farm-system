import { Router, type Request } from 'express';
import multer from 'multer';
import { asyncHandler } from '../../http/asyncHandler.js';
import { sendData } from '../../http/respond.js';
import { currentFarm, currentUser, requireFarmPermission } from '../../middleware/requirePermission.js';
import { commitCard } from './commit.js';
import { correctPhoto, readPhoto } from './photo.js';
import { clearKey, propose, readKey, saveKey, transcribe } from './propose.js';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 1 } });
export const saathiRoutes = Router();

function actor(req: Request) {
  return { user: currentUser(req), requestId: req.requestId };
}

function idempotencyOf(req: Request) {
  const header = req.get('idempotency-key');
  return { key: header && header.length > 0 ? header : null, method: req.method, path: req.originalUrl };
}

saathiRoutes.get(
  '/:farmId/saathi/key',
  ...requireFarmPermission('farm.read'),
  asyncHandler(async (req, res) => {
    sendData(res, 200, await readKey(currentFarm(req).farmId), req.requestId);
  }),
);

saathiRoutes.put(
  '/:farmId/saathi/key',
  ...requireFarmPermission('farm.update'),
  asyncHandler(async (req, res) => {
    sendData(res, 200, await saveKey(currentFarm(req), currentUser(req).id, req.body), req.requestId);
  }),
);

saathiRoutes.delete(
  '/:farmId/saathi/key',
  ...requireFarmPermission('farm.update'),
  asyncHandler(async (req, res) => {
    sendData(res, 200, await clearKey(currentFarm(req).farmId), req.requestId);
  }),
);

saathiRoutes.post(
  '/:farmId/saathi/propose',
  ...requireFarmPermission('farm.read'),
  asyncHandler(async (req, res) => {
    sendData(res, 200, await propose(actor(req), currentFarm(req), req.body), req.requestId);
  }),
);

saathiRoutes.post(
  '/:farmId/saathi/audio',
  ...requireFarmPermission('farm.read'),
  upload.single('file'),
  asyncHandler(async (req, res) => {
    let pending: unknown = null;
    try {
      pending = req.body?.pending ? JSON.parse(String(req.body.pending)) : null;
    } catch {
      pending = null;
    }
    sendData(res, 200, await transcribe(currentFarm(req), req.file, pending, actor(req)), req.requestId);
  }),
);

saathiRoutes.post(
  '/:farmId/saathi/commit',
  ...requireFarmPermission('farm.read'),
  asyncHandler(async (req, res) => {
    const saved = await commitCard(actor(req), currentFarm(req), req.body, idempotencyOf(req));
    sendData(res, saved.status, saved.data, req.requestId);
  }),
);

saathiRoutes.post(
  '/:farmId/saathi/photos',
  ...requireFarmPermission('farm.read'),
  upload.single('file'),
  asyncHandler(async (req, res) => {
    sendData(res, 201, await readPhoto(currentFarm(req).farmId, String(req.body?.kind ?? ''), req.file, actor(req)), req.requestId);
  }),
);

saathiRoutes.patch(
  '/:farmId/saathi/photos/:photoId',
  ...requireFarmPermission('farm.read'),
  asyncHandler(async (req, res) => {
    sendData(res, 200, await correctPhoto(currentFarm(req).farmId, String(req.params.photoId), req.body, actor(req)), req.requestId);
  }),
);
