import type { Request, Response } from 'express';
import { env } from '../config/env.js';

export const COOKIE = {
  access: 'gavran_access',
  refresh: 'gavran_refresh',
  csrf: 'gavran_csrf',
} as const;

const base = {
  sameSite: 'lax' as const,
  secure: env.COOKIE_SECURE,
  path: '/',
};

function cookieFlags(req?: Request) {
  const origin = req?.get('origin') ?? '';
  if (origin === 'https://localhost' || origin.startsWith('capacitor://')) {
    return { sameSite: 'none' as const, secure: true, path: '/' };
  }
  return base;
}

export function setSessionCookies(
  res: Response,
  tokens: { accessToken: string; refreshToken: string; csrfToken: string },
  req?: Request,
): void {
  const flags = cookieFlags(req);
  res.cookie(COOKIE.access, tokens.accessToken, {
    ...flags,
    httpOnly: true,
    maxAge: env.ACCESS_TOKEN_TTL_SECONDS * 1000,
  });
  res.cookie(COOKIE.refresh, tokens.refreshToken, {
    ...flags,
    httpOnly: true,
    maxAge: env.REFRESH_TOKEN_TTL_SECONDS * 1000,
  });
  res.cookie(COOKIE.csrf, tokens.csrfToken, {
    ...flags,
    httpOnly: false,
    maxAge: env.REFRESH_TOKEN_TTL_SECONDS * 1000,
  });
}

export function setCsrfCookie(res: Response, token: string, req?: Request): void {
  res.cookie(COOKIE.csrf, token, {
    ...cookieFlags(req),
    httpOnly: false,
    maxAge: env.REFRESH_TOKEN_TTL_SECONDS * 1000,
  });
}

export function clearSessionCookies(res: Response, req?: Request): void {
  const flags = cookieFlags(req);
  res.clearCookie(COOKIE.access, { ...flags, httpOnly: true });
  res.clearCookie(COOKIE.refresh, { ...flags, httpOnly: true });
  res.clearCookie(COOKIE.csrf, { ...flags, httpOnly: false });
}
