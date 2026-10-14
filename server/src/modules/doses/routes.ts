import { Router, type Request } from 'express';
import multer from 'multer';
import { AppError } from '../../http/errors.js';
import { asyncHandler } from '../../http/asyncHandler.js';
import { sendData } from '../../http/respond.js';
import { currentFarm, currentUser, requireFarmPermission } from '../../middleware/requirePermission.js';
import { approveSchedule, getBatchDoses, markDose, openMedicinePhoto, storeMedicinePhoto } from './service.js';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 1 } });
export const doseRoutes = Router();

function actor(req: Request) {
  return { user: currentUser(req), requestId: req.requestId };
}

function param(value: string | string[] | undefined): string {
  if (typeof value !== 'string' || value.length === 0) throw new AppError(404, 'NOT_FOUND', 'Not found.');
  return value;
}

doseRoutes.get(
  '/:farmId/batches/:batchId/doses',
  ...requireFarmPermission('health.read'),
  asyncHandler(async (req, res) => {
    sendData(res, 200, await getBatchDoses(currentFarm(req).farmId, param(req.params.batchId)), req.requestId);
  }),
);

doseRoutes.post(
  '/:farmId/dose-schedule/approval',
  ...requireFarmPermission('health.approve'),
  asyncHandler(async (req, res) => {
    sendData(res, 200, await approveSchedule(actor(req), currentFarm(req), req.body), req.requestId);
  }),
);

doseRoutes.post(
  '/:farmId/batches/:batchId/doses',
  ...requireFarmPermission('health.record'),
  asyncHandler(async (req, res) => {
    sendData(res, 201, await markDose(actor(req), currentFarm(req), param(req.params.batchId), req.body), req.requestId);
  }),
);

doseRoutes.post(
  '/:farmId/medicine-photos/:medicineKey',
  ...requireFarmPermission('health.approve'),
  upload.single('file'),
  asyncHandler(async (req, res) => {
    sendData(
      res,
      201,
      await storeMedicinePhoto(actor(req), currentFarm(req), param(req.params.medicineKey), req.file),
      req.requestId,
    );
  }),
);

doseRoutes.get(
  '/:farmId/medicine-photos/:medicineKey',
  ...requireFarmPermission('health.read'),
  asyncHandler(async (req, res) => {
    const opened = await openMedicinePhoto(currentFarm(req).farmId, param(req.params.medicineKey));
    res.setHeader('Content-Type', opened.mediaType);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, max-age=60');
    res.status(200).send(opened.bytes);
  }),
);
