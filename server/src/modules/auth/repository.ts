import { randomUUID } from 'node:crypto';
import type { RowDataPacket } from 'mysql2/promise';
import type { Locale } from '@gavran/shared';
import { asNumber, exec, iso, one, type Db } from '../../db/sql.js';
import { env } from '../../config/env.js';
import { hashToken, newToken } from '../../security/tokens.js';
import type { UserRecord } from './types.js';

type UserRow = RowDataPacket & {
  id: string;
  email: string;
  display_name: string;
  password_hash: string;
  status: 'active' | 'deactivated';
  preferred_locale: Locale;
  platform_role: 'system_administrator' | null;
};

function mapUser(row: UserRow): UserRecord {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    passwordHash: row.password_hash,
    status: row.status,
    preferredLocale: row.preferred_locale,
    platformRole: row.platform_role,
  };
}

const USER_COLUMNS = `id, email, display_name, password_hash, status, preferred_locale, platform_role`;

export async function lockUser(db: Db, userId: string): Promise<void> {
  await one(db, 'SELECT id FROM users WHERE id = ? FOR UPDATE', [userId]);
}

export async function countUsers(db: Db): Promise<number> {
  const row = await one<RowDataPacket & { n: number | string | bigint }>(db, 'SELECT COUNT(*) AS n FROM users');
  return row ? asNumber(row.n) : 0;
}

export async function insertUser(
  db: Db,
  input: {
    email: string;
    displayName: string;
    passwordHash: string;
    preferredLocale: Locale;
  },
): Promise<UserRecord> {
  const id = randomUUID();
  await exec(
    db,
    `INSERT INTO users (id, email, display_name, password_hash, preferred_locale)
     VALUES (?, ?, ?, ?, ?)`,
    [id, input.email, input.displayName, input.passwordHash, input.preferredLocale],
  );
  const created = await findUserById(db, id);
  if (!created) throw new Error('User insert failed.');
  return created;
}

export async function findUserByEmail(db: Db, email: string): Promise<UserRecord | null> {
  const row = await one<UserRow>(db, `SELECT ${USER_COLUMNS} FROM users WHERE email = ?`, [email]);
  return row ? mapUser(row) : null;
}

export async function findUserById(db: Db, id: string): Promise<UserRecord | null> {
  const row = await one<UserRow>(db, `SELECT ${USER_COLUMNS} FROM users WHERE id = ?`, [id]);
  return row ? mapUser(row) : null;
}

export async function updatePassword(db: Db, userId: string, passwordHash: string): Promise<void> {
  await exec(db, 'UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, userId]);
}

export async function updateProfile(
  db: Db,
  userId: string,
  patch: { displayName?: string; preferredLocale?: Locale },
): Promise<void> {
  const sets: string[] = [];
  const params: Array<string | number | Date | null> = [];
  if (patch.displayName !== undefined) {
    sets.push('display_name = ?');
    params.push(patch.displayName);
  }
  if (patch.preferredLocale !== undefined) {
    sets.push('preferred_locale = ?');
    params.push(patch.preferredLocale);
  }
  if (sets.length === 0) return;
  params.push(userId);
  await exec(db, `UPDATE users SET ${sets.join(', ')} WHERE id = ?`, params);
}

export async function setUserStatus(db: Db, userId: string, status: 'active' | 'deactivated'): Promise<void> {
  await exec(db, 'UPDATE users SET status = ? WHERE id = ?', [status, userId]);
}

export type SessionRecord = {
  id: string;
  userId: string;
  familyId: string;
  expiresAt: string;
  revokedAt: string | null;
  replacedBy: string | null;
};

type SessionRow = RowDataPacket & {
  id: string;
  user_id: string;
  family_id: string;
  expires_at: Date | string;
  revoked_at: Date | string | null;
  replaced_by: string | null;
};

function mapSession(row: SessionRow): SessionRecord {
  return {
    id: row.id,
    userId: row.user_id,
    familyId: row.family_id,
    expiresAt: iso(row.expires_at),
    revokedAt: row.revoked_at ? iso(row.revoked_at) : null,
    replacedBy: row.replaced_by,
  };
}

export async function insertSession(
  db: Db,
  input: { userId: string; familyId?: string; userAgent: string | null; ip: string },
): Promise<{ session: SessionRecord; refreshToken: string }> {
  const id = randomUUID();
  const familyId = input.familyId ?? randomUUID();
  const refreshToken = newToken();
  const expiresAt = new Date(Date.now() + env.REFRESH_TOKEN_TTL_SECONDS * 1000);
  await exec(
    db,
    `INSERT INTO sessions
      (id, user_id, refresh_token_hash, family_id, user_agent, ip_address, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, input.userId, hashToken(refreshToken), familyId, input.userAgent, input.ip, expiresAt],
  );
  return {
    refreshToken,
    session: {
      id,
      userId: input.userId,
      familyId,
      expiresAt: expiresAt.toISOString(),
      revokedAt: null,
      replacedBy: null,
    },
  };
}

export async function findSessionById(db: Db, id: string): Promise<SessionRecord | null> {
  const row = await one<SessionRow>(
    db,
    `SELECT id, user_id, family_id, expires_at, revoked_at, replaced_by FROM sessions WHERE id = ?`,
    [id],
  );
  return row ? mapSession(row) : null;
}

export async function findSessionByHash(db: Db, refreshToken: string, lock: boolean): Promise<SessionRecord | null> {
  const row = await one<SessionRow>(
    db,
    `SELECT id, user_id, family_id, expires_at, revoked_at, replaced_by
     FROM sessions WHERE refresh_token_hash = ?${lock ? ' FOR UPDATE' : ''}`,
    [hashToken(refreshToken)],
  );
  return row ? mapSession(row) : null;
}

export async function markSessionReplaced(db: Db, sessionId: string, replacedBy: string): Promise<void> {
  await exec(
    db,
    'UPDATE sessions SET revoked_at = CURRENT_TIMESTAMP(3), replaced_by = ? WHERE id = ? AND revoked_at IS NULL',
    [replacedBy, sessionId],
  );
}

export async function revokeSession(db: Db, sessionId: string): Promise<void> {
  await exec(db, 'UPDATE sessions SET revoked_at = CURRENT_TIMESTAMP(3) WHERE id = ? AND revoked_at IS NULL', [
    sessionId,
  ]);
}

export async function revokeFamily(db: Db, familyId: string): Promise<void> {
  await exec(
    db,
    'UPDATE sessions SET revoked_at = COALESCE(revoked_at, CURRENT_TIMESTAMP(3)) WHERE family_id = ?',
    [familyId],
  );
}

export async function revokeAllSessionsExcept(db: Db, userId: string, keepSessionId: string | null): Promise<void> {
  if (keepSessionId) {
    await exec(
      db,
      'UPDATE sessions SET revoked_at = CURRENT_TIMESTAMP(3) WHERE user_id = ? AND id <> ? AND revoked_at IS NULL',
      [userId, keepSessionId],
    );
    return;
  }
  await exec(db, 'UPDATE sessions SET revoked_at = CURRENT_TIMESTAMP(3) WHERE user_id = ? AND revoked_at IS NULL', [
    userId,
  ]);
}
