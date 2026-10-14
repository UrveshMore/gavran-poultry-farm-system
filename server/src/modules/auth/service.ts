import type { Locale } from '@gavran/shared';
import { changePasswordSchema, loginSchema, pinLoginSchema, profileSchema, registerSchema } from '@gavran/shared';
import { pool } from '../../db/pool.js';
import { withTransaction } from '../../db/transaction.js';
import { AppError } from '../../http/errors.js';
import { writeAudit } from '../audit/repository.js';
import { env } from '../../config/env.js';
import { dummyPasswordHash, hashPassword, verifyPassword } from '../../security/password.js';
import { createLoginThrottle } from '../../security/loginThrottle.js';
import { newToken, signAccessToken } from '../../security/tokens.js';
import {
  countUsers,
  findSessionByHash,
  findSessionById,
  findUserByEmail,
  findUserById,
  findUserByMobile,
  insertSession,
  insertUser,
  markSessionReplaced,
  revokeAllSessionsExcept,
  revokeFamily,
  revokeSession,
  updatePassword,
  updateProfile,
  type SessionRecord,
} from './repository.js';
import type { PublicUser, UserRecord } from './types.js';

const emailThrottle = createLoginThrottle(env.LOGIN_RATE_LIMIT_MAX, env.LOGIN_RATE_LIMIT_WINDOW_MS);
export const pinThrottle = createLoginThrottle(env.PIN_RATE_LIMIT_MAX, env.LOGIN_RATE_LIMIT_WINDOW_MS);

/** Email sign-in limit. `reset` also clears the PIN limit so API tests stay isolated. */
export const loginThrottle = {
  assert(key: string): void {
    emailThrottle.assert(key);
  },
  fail(key: string): void {
    emailThrottle.fail(key);
  },
  reset(): void {
    emailThrottle.reset();
    pinThrottle.reset();
  },
};

export type ClientMeta = { ip: string; userAgent: string | null; requestId: string };

export type IssuedSession = {
  user: PublicUser;
  accessToken: string;
  refreshToken: string;
  csrfToken: string;
};

function publicUser(user: UserRecord): PublicUser {
  return {
    id: user.id,
    email: user.email,
    mobile: user.mobile,
    displayName: user.displayName,
    preferredLocale: user.preferredLocale,
    platformRole: user.platformRole,
    status: user.status,
  };
}

async function issue(user: UserRecord, session: { session: SessionRecord; refreshToken: string }): Promise<IssuedSession> {
  return {
    user: publicUser(user),
    accessToken: await signAccessToken(user.id, session.session.id),
    refreshToken: session.refreshToken,
    csrfToken: newToken(),
  };
}

export async function bootstrapRequired(): Promise<boolean> {
  return (await countUsers(pool)) === 0;
}

export async function registerFirstOwner(body: unknown, meta: ClientMeta): Promise<IssuedSession> {
  const input = registerSchema.parse(body);
  const email = input.email.toLowerCase();
  const conn = await pool.getConnection();
  try {
    const [lockRows] = await conn.query<Array<{ got: number | null } & import('mysql2/promise').RowDataPacket>>(
      `SELECT GET_LOCK('gavran_bootstrap', 10) AS got`,
    );
    if (Number(lockRows[0]?.got) !== 1) {
      throw new AppError(503, 'BUSY', 'Could not start registration. Try again.');
    }
    await conn.beginTransaction();
    try {
      if ((await countUsers(conn)) > 0) {
        throw new AppError(403, 'BOOTSTRAP_CLOSED', 'Registration is closed. Ask the farm owner for an account.');
      }
      const user = await insertUser(conn, {
        email,
        displayName: input.displayName,
        passwordHash: await hashPassword(input.password),
        preferredLocale: input.preferredLocale,
      });
      await writeAudit(conn, {
        farmId: null,
        actorUserId: user.id,
        action: 'user.registered',
        entityType: 'user',
        entityId: user.id,
        requestId: meta.requestId,
        summary: { email: user.email },
      });
      const session = await insertSession(conn, { userId: user.id, userAgent: meta.userAgent, ip: meta.ip });
      await writeAudit(conn, {
        farmId: null,
        actorUserId: user.id,
        action: 'auth.login.success',
        entityType: 'session',
        entityId: session.session.id,
        requestId: meta.requestId,
        summary: { email: user.email },
      });
      await conn.commit();
      return issue(user, session);
    } catch (error) {
      await conn.rollback();
      throw error;
    }
  } finally {
    await conn.query(`SELECT RELEASE_LOCK('gavran_bootstrap')`);
    conn.release();
  }
}

export async function login(body: unknown, meta: ClientMeta): Promise<IssuedSession> {
  const input = loginSchema.parse(body);
  const email = input.email.toLowerCase();
  const emailKey = `email:${email}`;
  const ipKey = `ip:${meta.ip}`;
  loginThrottle.assert(emailKey);
  loginThrottle.assert(ipKey);
  const user = await findUserByEmail(pool, email);
  const ok = await verifyPassword(input.password, user?.passwordHash ?? (await dummyPasswordHash()));
  if (!user || !ok) {
    loginThrottle.fail(emailKey);
    loginThrottle.fail(ipKey);
    await writeAudit(pool, {
      farmId: null,
      actorUserId: user?.id ?? null,
      action: 'auth.login.failure',
      entityType: 'user',
      entityId: user?.id ?? null,
      requestId: meta.requestId,
      summary: { email, reason: 'invalid_credentials' },
    });
    throw new AppError(401, 'AUTH_INVALID_CREDENTIALS', 'Email or password is incorrect.');
  }
  if (user.status !== 'active') {
    throw new AppError(403, 'ACCOUNT_DEACTIVATED', 'This account is deactivated.');
  }
  const session = await withTransaction(async (conn) => {
    const created = await insertSession(conn, { userId: user.id, userAgent: meta.userAgent, ip: meta.ip });
    await writeAudit(conn, {
      farmId: null,
      actorUserId: user.id,
      action: 'auth.login.success',
      entityType: 'session',
      entityId: created.session.id,
      requestId: meta.requestId,
      summary: { email: user.email },
    });
    return created;
  });
  return issue(user, session);
}

export async function pinLogin(body: unknown, meta: ClientMeta): Promise<IssuedSession> {
  const input = pinLoginSchema.parse(body);
  const mobileKey = `pin:${input.mobile}`;
  const ipKey = `ip:${meta.ip}`;
  pinThrottle.assert(mobileKey);
  pinThrottle.assert(ipKey);
  const user = await findUserByMobile(pool, input.mobile);
  const ok = await verifyPassword(input.pin, user?.pinHash ?? (await dummyPasswordHash()));
  if (!user || !ok) {
    pinThrottle.fail(mobileKey);
    pinThrottle.fail(ipKey);
    await writeAudit(pool, {
      farmId: null,
      actorUserId: user?.id ?? null,
      action: 'auth.login.failure',
      entityType: 'user',
      entityId: user?.id ?? null,
      requestId: meta.requestId,
      summary: { mobile: input.mobile, reason: 'invalid_credentials' },
    });
    throw new AppError(401, 'AUTH_INVALID_CREDENTIALS', 'Mobile number or PIN is incorrect.');
  }
  if (user.status !== 'active') {
    throw new AppError(403, 'ACCOUNT_DEACTIVATED', 'This account is deactivated.');
  }
  const session = await withTransaction(async (conn) => {
    const created = await insertSession(conn, { userId: user.id, userAgent: meta.userAgent, ip: meta.ip });
    await writeAudit(conn, {
      farmId: null,
      actorUserId: user.id,
      action: 'auth.login.success',
      entityType: 'session',
      entityId: created.session.id,
      requestId: meta.requestId,
      summary: { mobile: user.mobile },
    });
    return created;
  });
  return issue(user, session);
}

export async function refresh(refreshToken: string | undefined, meta: ClientMeta): Promise<IssuedSession> {
  if (!refreshToken) throw new AppError(401, 'AUTH_REQUIRED', 'Sign in required.');
  const outcome = await withTransaction(async (conn) => {
    const current = await findSessionByHash(conn, refreshToken, true);
    if (!current) return { kind: 'denied' as const };
    if (current.revokedAt || current.replacedBy) {
      await revokeFamily(conn, current.familyId);
      await writeAudit(conn, {
        farmId: null,
        actorUserId: current.userId,
        action: 'auth.refresh.reuse',
        entityType: 'session',
        entityId: current.id,
        requestId: meta.requestId,
        summary: { familyId: current.familyId },
      });
      return { kind: 'denied' as const };
    }
    if (new Date(current.expiresAt).getTime() <= Date.now()) return { kind: 'denied' as const };
    const user = await findUserById(conn, current.userId);
    if (!user || user.status !== 'active') {
      await revokeSession(conn, current.id);
      return { kind: 'denied' as const };
    }
    const next = await insertSession(conn, {
      userId: user.id,
      familyId: current.familyId,
      userAgent: meta.userAgent,
      ip: meta.ip,
    });
    await markSessionReplaced(conn, current.id, next.session.id);
    await writeAudit(conn, {
      farmId: null,
      actorUserId: user.id,
      action: 'auth.refresh',
      entityType: 'session',
      entityId: next.session.id,
      requestId: meta.requestId,
      summary: { email: user.email },
    });
    return { kind: 'ok' as const, issued: await issue(user, next) };
  });
  if (outcome.kind === 'denied') throw new AppError(401, 'AUTH_REQUIRED', 'Sign in required.');
  return outcome.issued;
}

export async function logout(sessionId: string | null, meta: ClientMeta, actorUserId: string | null): Promise<void> {
  if (sessionId) {
    await withTransaction(async (conn) => {
      await revokeSession(conn, sessionId);
      await writeAudit(conn, {
        farmId: null,
        actorUserId,
        action: 'auth.logout',
        entityType: 'session',
        entityId: sessionId,
        requestId: meta.requestId,
        summary: {},
      });
    });
  }
}

export async function logoutAll(userId: string, meta: ClientMeta): Promise<void> {
  await withTransaction(async (conn) => {
    await revokeAllSessionsExcept(conn, userId, null);
    await writeAudit(conn, {
      farmId: null,
      actorUserId: userId,
      action: 'auth.logout_all',
      entityType: 'user',
      entityId: userId,
      requestId: meta.requestId,
      summary: {},
    });
  });
}

export async function changePassword(userId: string, sessionId: string, body: unknown, meta: ClientMeta): Promise<void> {
  const input = changePasswordSchema.parse(body);
  const user = await findUserById(pool, userId);
  if (!user || user.status !== 'active') throw new AppError(401, 'AUTH_REQUIRED', 'Sign in required.');
  const ok = user.passwordHash ? await verifyPassword(input.currentPassword, user.passwordHash) : false;
  if (!ok) throw new AppError(401, 'AUTH_INVALID_CREDENTIALS', 'Email or password is incorrect.');
  const passwordHash = await hashPassword(input.newPassword);
  await withTransaction(async (conn) => {
    await updatePassword(conn, userId, passwordHash);
    await revokeAllSessionsExcept(conn, userId, sessionId);
    await writeAudit(conn, {
      farmId: null,
      actorUserId: userId,
      action: 'auth.password.changed',
      entityType: 'user',
      entityId: userId,
      requestId: meta.requestId,
      summary: {},
    });
  });
}

export async function updateOwnProfile(userId: string, body: unknown, meta: ClientMeta): Promise<PublicUser> {
  const input = profileSchema.parse(body);
  await withTransaction(async (conn) => {
    await updateProfile(conn, userId, {
      ...(input.displayName !== undefined ? { displayName: input.displayName } : {}),
      ...(input.preferredLocale !== undefined ? { preferredLocale: input.preferredLocale } : {}),
    });
    await writeAudit(conn, {
      farmId: null,
      actorUserId: userId,
      action: 'user.profile.updated',
      entityType: 'user',
      entityId: userId,
      requestId: meta.requestId,
      summary: {
        ...(input.displayName !== undefined ? { displayName: input.displayName } : {}),
        ...(input.preferredLocale !== undefined ? { preferredLocale: input.preferredLocale } : {}),
      },
    });
  });
  const updated = await findUserById(pool, userId);
  if (!updated) throw new AppError(401, 'AUTH_REQUIRED', 'Sign in required.');
  return publicUser(updated);
}

export async function currentPublicUser(userId: string): Promise<PublicUser> {
  const user = await findUserById(pool, userId);
  if (!user || user.status !== 'active') throw new AppError(401, 'AUTH_REQUIRED', 'Sign in required.');
  return publicUser(user);
}

export async function sessionFromAccess(sessionId: string, userId: string): Promise<boolean> {
  const session = await findSessionById(pool, sessionId);
  if (!session || session.userId !== userId || session.revokedAt || session.replacedBy) return false;
  return new Date(session.expiresAt).getTime() > Date.now();
}

export function normalizeLocale(value: string | undefined): Locale | undefined {
  if (value === 'en' || value === 'hi' || value === 'mr') return value;
  return undefined;
}
