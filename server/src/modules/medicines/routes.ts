import { Router, type Request } from 'express';
import multer from 'multer';
import { AppError } from '../../http/errors.js';
import { asyncHandler } from '../../http/asyncHandler.js';
import { sendData } from '../../http/respond.js';
import { currentFarm, currentUser, requireFarmPermission } from '../../middleware/requirePermission.js';
import {
  archiveMedicine,
  attachPlan,
  createDisease,
  createMedicine,
  listMedicines,
  medicineChoices,
  storeDiseasePhoto,
  storeOwnerPhoto,
  updateMedicine,
} from './service.js';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 12 * 1024 * 1024, files: 1 } });
export const medicineRoutes = Router();

function actor(req: Request) {
  return { user: currentUser(req), requestId: req.requestId };
}

function param(value: string | string[] | undefined): string {
  if (typeof value !== 'string' || value.length === 0) throw new AppError(404, 'NOT_FOUND', 'Not found.');
  return value;
}

medicineRoutes.get(
  '/:farmId/owner-medicines/choices',
  ...requireFarmPermission('health.approve'),
  asyncHandler(async (req, res) => {
    sendData(res, 200, await medicineChoices(currentFarm(req).farmId), req.requestId);
  }),
);

medicineRoutes.get(
  '/:farmId/owner-medicines',
  ...requireFarmPermission('health.approve'),
  asyncHandler(async (req, res) => {
    sendData(res, 200, await listMedicines(currentFarm(req).farmId), req.requestId);
  }),
);

medicineRoutes.post(
  '/:farmId/owner-diseases',
  ...requireFarmPermission('health.approve'),
  asyncHandler(async (req, res) => {
    sendData(res, 201, await createDisease(actor(req), currentFarm(req), req.body), req.requestId);
  }),
);

medicineRoutes.post(
  '/:farmId/owner-diseases/:diseaseId/photos',
  ...requireFarmPermission('health.approve'),
  upload.single('file'),
  asyncHandler(async (req, res) => {
    sendData(res, 201, await storeDiseasePhoto(actor(req), currentFarm(req), param(req.params.diseaseId), req.file), req.requestId);
  }),
);

medicineRoutes.post(
  '/:farmId/owner-medicines',
  ...requireFarmPermission('health.approve'),
  asyncHandler(async (req, res) => {
    sendData(res, 201, await createMedicine(actor(req), currentFarm(req), req.body), req.requestId);
  }),
);

medicineRoutes.patch(
  '/:farmId/owner-medicines/:medicineId',
  ...requireFarmPermission('health.approve'),
  asyncHandler(async (req, res) => {
    sendData(res, 200, await updateMedicine(actor(req), currentFarm(req), param(req.params.medicineId), req.body), req.requestId);
  }),
);

medicineRoutes.delete(
  '/:farmId/owner-medicines/:medicineId',
  ...requireFarmPermission('health.approve'),
  asyncHandler(async (req, res) => {
    sendData(res, 200, await archiveMedicine(actor(req), currentFarm(req), param(req.params.medicineId)), req.requestId);
  }),
);

medicineRoutes.post(
  '/:farmId/owner-medicines/:medicineId/photo',
  ...requireFarmPermission('health.approve'),
  upload.single('file'),
  asyncHandler(async (req, res) => {
    sendData(res, 201, await storeOwnerPhoto(actor(req), currentFarm(req), param(req.params.medicineId), req.file), req.requestId);
  }),
);

medicineRoutes.post(
  '/:farmId/owner-medicines/:medicineId/plans',
  ...requireFarmPermission('health.approve'),
  asyncHandler(async (req, res) => {
    sendData(res, 201, await attachPlan(actor(req), currentFarm(req), param(req.params.medicineId), req.body), req.requestId);
  }),
);
