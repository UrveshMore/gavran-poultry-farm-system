import type { PermissionCode } from '@gavran/shared';
import type { RequestHandler } from 'express';
import { AppError } from '../http/errors.js';
import { asyncHandler } from '../http/asyncHandler.js';
import { loadAccess } from '../modules/farms/repository.js';
import { pool } from '../db/pool.js';
import { authenticate } from './authenticate.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function requireFarmPermission(permission: PermissionCode): RequestHandler[] {
  return [
    authenticate,
    asyncHandler(async (req, _res, next) => {
      const farmId = req.params.farmId;
      if (typeof farmId !== 'string' || !UUID_RE.test(farmId) || !req.authUser) {
        throw new AppError(404, 'NOT_FOUND', 'Not found.');
      }
      const access = await loadAccess(pool, req.authUser.id, farmId);
      if (!access) throw new AppError(404, 'NOT_FOUND', 'Not found.');
      if (!access.permissions.includes(permission)) {
        throw new AppError(403, 'FORBIDDEN', 'You do not have permission to do that.');
      }
      req.farmAccess = access;
      next();
    }),
  ];
}

export function currentUser(req: { authUser?: Express.Request['authUser'] }) {
  if (!req.authUser) throw new AppError(401, 'AUTH_REQUIRED', 'Sign in required.');
  return req.authUser;
}

export function currentFarm(req: { farmAccess?: Express.Request['farmAccess'] }) {
  if (!req.farmAccess) throw new AppError(404, 'NOT_FOUND', 'Not found.');
  return req.farmAccess;
}
