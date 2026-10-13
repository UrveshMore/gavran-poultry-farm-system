import type { RequestHandler } from 'express';
import { COOKIE } from '../http/cookies.js';
import { AppError } from '../http/errors.js';
import { tokensMatch } from '../security/tokens.js';

const SAFE = new Set(['GET', 'HEAD', 'OPTIONS']);

export const csrfProtection: RequestHandler = (req, _res, next) => {
  if (SAFE.has(req.method)) {
    next();
    return;
  }
  const cookie = req.cookies?.[COOKIE.csrf];
  const header = req.get('x-csrf-token');
  if (typeof cookie !== 'string' || !header || !tokensMatch(cookie, header)) {
    next(new AppError(403, 'CSRF_INVALID', 'Missing or invalid CSRF token.'));
    return;
  }
  next();
};
