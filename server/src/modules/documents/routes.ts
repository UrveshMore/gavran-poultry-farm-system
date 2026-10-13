import { Router, type Request } from 'express';
import multer from 'multer';
import { AppError } from '../../http/errors.js';
import { asyncHandler } from '../../http/asyncHandler.js';
import { sendData } from '../../http/respond.js';
import { currentFarm, currentUser, requireFarmPermission } from '../../middleware/requirePermission.js';
import { getDocuments, openDocument, storeDocument } from './service.js';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 1 } });
export const documentRoutes = Router();

function idempotencyOf(req: Request) {
  const header = req.get('idempotency-key');
  return { key: header && header.length > 0 ? header : null, method: req.method, path: req.originalUrl };
}
function param(value: string | string[] | undefined): string {
  if (typeof value !== 'string' || value.length === 0) throw new AppError(404, 'NOT_FOUND', 'Not found.');
  return value;
}

documentRoutes.get('/:farmId/documents', ...requireFarmPermission('document.read'), asyncHandler(async (req, res) => {
  sendData(res, 200, await getDocuments(currentFarm(req).farmId), req.requestId);
}));
documentRoutes.post(
  '/:farmId/documents',
  ...requireFarmPermission('document.record'),
  upload.single('file'),
  asyncHandler(async (req, res) => {
    const result = await storeDocument(
      { user: currentUser(req), requestId: req.requestId },
      currentFarm(req),
      req.file,
      req.body,
      idempotencyOf(req),
    );
    sendData(res, result.status, result.data, req.requestId);
  }),
);
documentRoutes.get('/:farmId/documents/:fileId/file', ...requireFarmPermission('document.read'), asyncHandler(async (req, res) => {
  const opened = await openDocument(currentFarm(req).farmId, param(req.params.fileId));
  res.setHeader('Content-Type', opened.file.mediaType);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Disposition', `attachment; filename="${opened.file.originalName.replace(/"/g, '')}"`);
  res.status(200).send(opened.bytes);
}));
