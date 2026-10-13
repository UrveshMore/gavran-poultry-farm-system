import type { Response } from 'express';
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

export function setSessionCookies(
  res: Response,
  tokens: { accessToken: string; refreshToken: string; csrfToken: string },
): void {
  res.cookie(COOKIE.access, tokens.accessToken, {
    ...base,
    httpOnly: true,
    maxAge: env.ACCESS_TOKEN_TTL_SECONDS * 1000,
  });
  res.cookie(COOKIE.refresh, tokens.refreshToken, {
    ...base,
    httpOnly: true,
    maxAge: env.REFRESH_TOKEN_TTL_SECONDS * 1000,
  });
  res.cookie(COOKIE.csrf, tokens.csrfToken, {
    ...base,
    httpOnly: false,
    maxAge: env.REFRESH_TOKEN_TTL_SECONDS * 1000,
  });
}

export function setCsrfCookie(res: Response, token: string): void {
  res.cookie(COOKIE.csrf, token, {
    ...base,
    httpOnly: false,
    maxAge: env.REFRESH_TOKEN_TTL_SECONDS * 1000,
  });
}

export function clearSessionCookies(res: Response): void {
  res.clearCookie(COOKIE.access, { ...base, httpOnly: true });
  res.clearCookie(COOKIE.refresh, { ...base, httpOnly: true });
  res.clearCookie(COOKIE.csrf, { ...base, httpOnly: false });
}
