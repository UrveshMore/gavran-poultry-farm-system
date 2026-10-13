import { Router, type Request } from 'express';
import { COOKIE, clearSessionCookies, setCsrfCookie, setSessionCookies } from '../../http/cookies.js';
import { asyncHandler } from '../../http/asyncHandler.js';
import { sendData } from '../../http/respond.js';
import { newToken, verifyAccessToken } from '../../security/tokens.js';
import { clientIp, clientUserAgent } from '../../middleware/context.js';
import { authenticate } from '../../middleware/authenticate.js';
import { currentUser } from '../../middleware/requirePermission.js';
import {
  bootstrapRequired,
  changePassword,
  currentPublicUser,
  login,
  logout,
  logoutAll,
  refresh,
  registerFirstOwner,
  updateOwnProfile,
} from './service.js';

export const authRoutes = Router();

function meta(req: Request) {
  return { ip: clientIp(req), userAgent: clientUserAgent(req), requestId: req.requestId };
}

authRoutes.get(
  '/csrf',
  asyncHandler(async (req, res) => {
    const existing = req.cookies?.[COOKIE.csrf];
    const token = typeof existing === 'string' && existing.length > 0 ? existing : newToken();
    if (token !== existing) setCsrfCookie(res, token);
    sendData(res, 200, { csrfToken: token }, req.requestId);
  }),
);

authRoutes.get(
  '/bootstrap',
  asyncHandler(async (req, res) => {
    sendData(res, 200, { bootstrapRequired: await bootstrapRequired() }, req.requestId);
  }),
);

authRoutes.post(
  '/register',
  asyncHandler(async (req, res) => {
    const issued = await registerFirstOwner(req.body, meta(req));
    setSessionCookies(res, issued);
    sendData(res, 201, { user: issued.user, csrfToken: issued.csrfToken }, req.requestId);
  }),
);

authRoutes.post(
  '/login',
  asyncHandler(async (req, res) => {
    const issued = await login(req.body, meta(req));
    setSessionCookies(res, issued);
    sendData(res, 200, { user: issued.user, csrfToken: issued.csrfToken }, req.requestId);
  }),
);

authRoutes.post(
  '/refresh',
  asyncHandler(async (req, res) => {
    const token = req.cookies?.[COOKIE.refresh];
    const issued = await refresh(typeof token === 'string' ? token : undefined, meta(req));
    setSessionCookies(res, issued);
    sendData(res, 200, { user: issued.user, csrfToken: issued.csrfToken }, req.requestId);
  }),
);

authRoutes.post(
  '/logout',
  asyncHandler(async (req, res) => {
    const access = req.cookies?.[COOKIE.access];
    const payload = typeof access === 'string' ? await verifyAccessToken(access) : null;
    await logout(payload?.sid ?? null, meta(req), payload?.sub ?? null);
    clearSessionCookies(res);
    sendData(res, 200, { signedOut: true }, req.requestId);
  }),
);

authRoutes.post(
  '/logout-all',
  authenticate,
  asyncHandler(async (req, res) => {
    const user = currentUser(req);
    await logoutAll(user.id, meta(req));
    clearSessionCookies(res);
    sendData(res, 200, { signedOut: true }, req.requestId);
  }),
);

authRoutes.get(
  '/me',
  authenticate,
  asyncHandler(async (req, res) => {
    sendData(res, 200, await currentPublicUser(currentUser(req).id), req.requestId);
  }),
);

authRoutes.patch(
  '/me',
  authenticate,
  asyncHandler(async (req, res) => {
    const user = await updateOwnProfile(currentUser(req).id, req.body, meta(req));
    sendData(res, 200, user, req.requestId);
  }),
);

authRoutes.post(
  '/change-password',
  authenticate,
  asyncHandler(async (req, res) => {
    const user = currentUser(req);
    await changePassword(user.id, user.sessionId, req.body, meta(req));
    sendData(res, 200, { changed: true }, req.requestId);
  }),
);
