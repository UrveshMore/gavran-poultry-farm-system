import type { RequestHandler } from 'express';
import { COOKIE } from '../http/cookies.js';
import { AppError } from '../http/errors.js';
import { asyncHandler } from '../http/asyncHandler.js';
import { findUserById } from '../modules/auth/repository.js';
import { sessionFromAccess } from '../modules/auth/service.js';
import { verifyAccessToken } from '../security/tokens.js';
import { pool } from '../db/pool.js';

export const authenticate: RequestHandler = asyncHandler(async (req, _res, next) => {
  const token = req.cookies?.[COOKIE.access];
  if (typeof token !== 'string' || token.length === 0) {
    throw new AppError(401, 'AUTH_REQUIRED', 'Sign in required.');
  }
  const payload = await verifyAccessToken(token);
  if (!payload) throw new AppError(401, 'AUTH_REQUIRED', 'Sign in required.');
  const valid = await sessionFromAccess(payload.sid, payload.sub);
  if (!valid) throw new AppError(401, 'AUTH_REQUIRED', 'Sign in required.');
  const user = await findUserById(pool, payload.sub);
  if (!user || user.status !== 'active') throw new AppError(401, 'AUTH_REQUIRED', 'Sign in required.');
  req.authUser = {
    id: user.id,
    email: user.email,
    mobile: user.mobile,
    displayName: user.displayName,
    preferredLocale: user.preferredLocale,
    platformRole: user.platformRole,
    status: user.status,
    sessionId: payload.sid,
  };
  next();
});
