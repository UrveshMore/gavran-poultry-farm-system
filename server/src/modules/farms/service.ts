import {
  CAPACITY_UNIT,
  farmInputSchema,
  farmUpdateSchema,
  inviteSchema,
  isPermission,
  membershipUpdateSchema,
  pinPersonSchema,
  pinResetSchema,
  shedInputSchema,
  shedUpdateSchema,
  type FarmInput,
  type FarmRole,
  type MembershipUpdateInput,
  type PermissionCode,
} from '@gavran/shared';
import { isDup } from '../../db/sql.js';
import { withTransaction } from '../../db/transaction.js';
import { pool } from '../../db/pool.js';
import { AppError } from '../../http/errors.js';
import { finishIdempotency, requestPath, reserveIdempotency } from '../../http/idempotency.js';
import { writeAudit } from '../audit/repository.js';
import { listAudit } from '../audit/repository.js';
import {
  findUserByEmail,
  findUserById,
  findUserByMobile,
  insertPinUser,
  insertUser,
  lockUser,
  revokeAllSessionsExcept,
  setUserStatus,
  updatePinHash,
} from '../auth/repository.js';
import { hashPassword } from '../../security/password.js';
import type { AuthUser } from '../auth/types.js';
import type { FarmAccess } from './access.js';
import {
  countActiveOwners,
  findFarmById,
  findOwnedFarms,
  findShed,
  insertFarm,
  insertMembership,
  insertShed,
  listFarmsForUser,
  listMembers,
  listMembershipSnaps,
  listSheds,
  loadAccess,
  replaceGrants,
  setMembershipRoleStatus,
  updateFarm,
  updateShed,
  type FarmListItem,
  type FarmPatch,
  type FarmRecord,
  type MemberRecord,
  type MembershipSnap,
  type ShedPatch,
  type ShedRecord,
} from './repository.js';

type IdempotencyInput = { key: string | null; method: string; path: string };
type Actor = { user: AuthUser; requestId: string };

function emptyToNull(value: string | null | undefined): string | null {
  if (value === undefined || value === null) return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

function normalizeFarm(input: FarmInput): {
  name: string;
  code: string;
  timezone: string;
  locale: FarmInput['locale'];
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  addressLine: string | null;
  weightUnit: FarmInput['weightUnit'];
  volumeUnit: FarmInput['volumeUnit'];
} {
  return {
    name: input.name.trim(),
    code: input.code.trim().toUpperCase(),
    timezone: input.timezone.trim(),
    locale: input.locale,
    contactName: emptyToNull(input.contactName),
    contactPhone: emptyToNull(input.contactPhone),
    contactEmail: emptyToNull(input.contactEmail)?.toLowerCase() ?? null,
    addressLine: emptyToNull(input.addressLine),
    weightUnit: input.weightUnit,
    volumeUnit: input.volumeUnit,
  };
}

function changedKeys(before: Record<string, unknown>, after: Record<string, unknown>): string[] {
  return Object.keys(after).filter((key) => before[key] !== after[key]);
}

export async function listMyFarms(userId: string): Promise<FarmListItem[]> {
  return listFarmsForUser(pool, userId);
}

export async function getFarm(access: FarmAccess): Promise<FarmRecord & { role: FarmRole; permissions: PermissionCode[] }> {
  const farm = await findFarmById(pool, access.farmId, false);
  if (!farm) throw new AppError(404, 'NOT_FOUND', 'Not found.');
  return { ...farm, role: access.role, permissions: access.permissions };
}

export async function createFarm(actor: Actor, body: unknown, idempotency: IdempotencyInput) {
  const input = normalizeFarm(farmInputSchema.parse(body));
  const path = requestPath(idempotency.path);
  try {
    return await withTransaction(async (conn) => {
      const reserved = await reserveIdempotency(conn, {
        userId: actor.user.id,
        farmId: null,
        key: idempotency.key,
        method: idempotency.method,
        path,
      });
      if (reserved.mode === 'replay') return reserved;
      await lockUser(conn, actor.user.id);
      const existing = await listFarmsForUser(conn, actor.user.id);
      const isOwner = existing.some((farm) => farm.role === 'owner');
      if (existing.length > 0 && !isOwner) {
        throw new AppError(403, 'FORBIDDEN', 'You cannot create a farm.');
      }
      const farm = await insertFarm(conn, { ...input, createdBy: actor.user.id });
      const membershipId = await insertMembership(conn, {
        farmId: farm.id,
        userId: actor.user.id,
        role: 'owner',
        createdBy: actor.user.id,
      });
      await writeAudit(conn, {
        farmId: farm.id,
        actorUserId: actor.user.id,
        action: 'farm.created',
        entityType: 'farm',
        entityId: farm.id,
        requestId: actor.requestId,
        summary: { name: farm.name, code: farm.code },
      });
      await writeAudit(conn, {
        farmId: farm.id,
        actorUserId: actor.user.id,
        action: 'membership.created',
        entityType: 'membership',
        entityId: membershipId,
        requestId: actor.requestId,
        summary: { email: actor.user.email, role: 'owner', grants: [] },
      });
      const data = { ...farm, role: 'owner' as const, permissions: (await loadAccess(conn, actor.user.id, farm.id))?.permissions ?? [] };
      if (reserved.mode === 'new') await finishIdempotency(conn, reserved.id, 201, data);
      return { mode: 'created' as const, status: 201, data };
    });
  } catch (error) {
    if (isDup(error)) throw new AppError(409, 'DUPLICATE_CODE', 'That farm code is already used.');
    throw error;
  }
}

export async function patchFarm(actor: Actor, access: FarmAccess, body: unknown) {
  const parsed = farmUpdateSchema.parse(body);
  const { version, ...rest } = parsed;
  const patch = normalizeFarm({
    name: rest.name ?? 'placeholder',
    code: rest.code ?? 'AA',
    timezone: rest.timezone ?? 'UTC',
    locale: rest.locale ?? 'en',
    contactName: rest.contactName ?? '',
    contactPhone: rest.contactPhone ?? '',
    contactEmail: rest.contactEmail ?? '',
    addressLine: rest.addressLine ?? '',
    weightUnit: rest.weightUnit ?? 'kg',
    volumeUnit: rest.volumeUnit ?? 'L',
  });
  const defined: FarmPatch = {};
  if (rest.name !== undefined) defined.name = patch.name;
  if (rest.code !== undefined) defined.code = patch.code;
  if (rest.timezone !== undefined) defined.timezone = patch.timezone;
  if (rest.locale !== undefined) defined.locale = patch.locale;
  if (rest.contactName !== undefined) defined.contactName = patch.contactName;
  if (rest.contactPhone !== undefined) defined.contactPhone = patch.contactPhone;
  if (rest.contactEmail !== undefined) defined.contactEmail = patch.contactEmail;
  if (rest.addressLine !== undefined) defined.addressLine = patch.addressLine;
  if (rest.weightUnit !== undefined) defined.weightUnit = patch.weightUnit;
  if (rest.volumeUnit !== undefined) defined.volumeUnit = patch.volumeUnit;

  try {
    return await withTransaction(async (conn) => {
      const current = await findFarmById(conn, access.farmId, true);
      if (!current) throw new AppError(404, 'NOT_FOUND', 'Not found.');
      if (current.version !== version) throw new AppError(409, 'VERSION_CONFLICT', 'This farm was updated. Reload and try again.');
      const ok = await updateFarm(conn, access.farmId, version, defined);
      if (!ok) throw new AppError(409, 'VERSION_CONFLICT', 'This farm was updated. Reload and try again.');
      const updated = await findFarmById(conn, access.farmId, false);
      if (!updated) throw new AppError(404, 'NOT_FOUND', 'Not found.');
      await writeAudit(conn, {
        farmId: access.farmId,
        actorUserId: actor.user.id,
        action: 'farm.updated',
        entityType: 'farm',
        entityId: access.farmId,
        requestId: actor.requestId,
        summary: {
          changed: changedKeys(
            {
              name: current.name,
              code: current.code,
              timezone: current.timezone,
              locale: current.locale,
              contactName: current.contactName,
              contactPhone: current.contactPhone,
              contactEmail: current.contactEmail,
              addressLine: current.addressLine,
              weightUnit: current.weightUnit,
              volumeUnit: current.volumeUnit,
            },
            {
              name: updated.name,
              code: updated.code,
              timezone: updated.timezone,
              locale: updated.locale,
              contactName: updated.contactName,
              contactPhone: updated.contactPhone,
              contactEmail: updated.contactEmail,
              addressLine: updated.addressLine,
              weightUnit: updated.weightUnit,
              volumeUnit: updated.volumeUnit,
            },
          ),
        },
      });
      return { ...updated, role: access.role, permissions: access.permissions };
    });
  } catch (error) {
    if (isDup(error)) throw new AppError(409, 'DUPLICATE_CODE', 'That farm code is already used.');
    throw error;
  }
}

export async function getSheds(farmId: string): Promise<ShedRecord[]> {
  return listSheds(pool, farmId);
}

export async function createShed(actor: Actor, access: FarmAccess, body: unknown, idempotency: IdempotencyInput) {
  const input = shedInputSchema.parse(body);
  const path = requestPath(idempotency.path);
  try {
    return await withTransaction(async (conn) => {
      const reserved = await reserveIdempotency(conn, {
        userId: actor.user.id,
        farmId: access.farmId,
        key: idempotency.key,
        method: idempotency.method,
        path,
      });
      if (reserved.mode === 'replay') return reserved;
      const shed = await insertShed(conn, {
        farmId: access.farmId,
        code: input.code.trim().toUpperCase(),
        name: input.name.trim(),
        shedType: input.shedType,
        usableCapacity: input.usableCapacity,
        capacityUnit: CAPACITY_UNIT,
        status: input.status,
        notes: emptyToNull(input.notes),
        createdBy: actor.user.id,
      });
      await writeAudit(conn, {
        farmId: access.farmId,
        actorUserId: actor.user.id,
        action: 'shed.created',
        entityType: 'shed',
        entityId: shed.id,
        requestId: actor.requestId,
        summary: { code: shed.code, name: shed.name, shedType: shed.shedType },
      });
      if (reserved.mode === 'new') await finishIdempotency(conn, reserved.id, 201, shed);
      return { mode: 'created' as const, status: 201, data: shed };
    });
  } catch (error) {
    if (isDup(error)) throw new AppError(409, 'DUPLICATE_CODE', 'That shed code is already used on this farm.');
    throw error;
  }
}

export async function patchShed(actor: Actor, access: FarmAccess, shedId: string, body: unknown): Promise<ShedRecord> {
  if (!/^[0-9a-f-]{36}$/i.test(shedId)) throw new AppError(404, 'NOT_FOUND', 'Not found.');
  const parsed = shedUpdateSchema.parse(body);
  const { version, ...rest } = parsed;
  const patch: ShedPatch = {};
  if (rest.code !== undefined) patch.code = rest.code.trim().toUpperCase();
  if (rest.name !== undefined) patch.name = rest.name.trim();
  if (rest.shedType !== undefined) patch.shedType = rest.shedType;
  if (rest.usableCapacity !== undefined) patch.usableCapacity = rest.usableCapacity;
  if (rest.status !== undefined) patch.status = rest.status;
  if (rest.notes !== undefined) patch.notes = emptyToNull(rest.notes);
  try {
    return await withTransaction(async (conn) => {
      const current = await findShed(conn, access.farmId, shedId, true);
      if (!current) throw new AppError(404, 'NOT_FOUND', 'Not found.');
      if (current.version !== version) {
        throw new AppError(409, 'VERSION_CONFLICT', 'This shed was updated. Reload and try again.');
      }
      const ok = await updateShed(conn, access.farmId, shedId, version, patch);
      if (!ok) throw new AppError(409, 'VERSION_CONFLICT', 'This shed was updated. Reload and try again.');
      const updated = await findShed(conn, access.farmId, shedId, false);
      if (!updated) throw new AppError(404, 'NOT_FOUND', 'Not found.');
      await writeAudit(conn, {
        farmId: access.farmId,
        actorUserId: actor.user.id,
        action: 'shed.updated',
        entityType: 'shed',
        entityId: shedId,
        requestId: actor.requestId,
        summary: {
          code: updated.code,
          changed: changedKeys(
            {
              code: current.code,
              name: current.name,
              shedType: current.shedType,
              usableCapacity: current.usableCapacity,
              status: current.status,
              notes: current.notes,
            },
            {
              code: updated.code,
              name: updated.name,
              shedType: updated.shedType,
              usableCapacity: updated.usableCapacity,
              status: updated.status,
              notes: updated.notes,
            },
          ),
        },
      });
      return updated;
    });
  } catch (error) {
    if (isDup(error)) throw new AppError(409, 'DUPLICATE_CODE', 'That shed code is already used on this farm.');
    throw error;
  }
}

function assertOwnerOnly(access: FarmAccess, message: string): void {
  if (access.role !== 'owner') throw new AppError(403, 'FORBIDDEN', message);
}

function ownerCount(rows: MembershipSnap[]): number {
  return rows.filter((row) => row.status === 'active' && row.role === 'owner').length;
}

export async function getMembers(farmId: string): Promise<MemberRecord[]> {
  return listMembers(pool, farmId);
}

export async function inviteMember(actor: Actor, access: FarmAccess, body: unknown, idempotency: IdempotencyInput) {
  const input = inviteSchema.parse(body);
  const email = input.email.toLowerCase();
  const grants = input.role === 'family_helper' ? input.permissionGrants.filter(isPermission) : [];
  if (input.role === 'owner') assertOwnerOnly(access, 'Only an owner can assign the owner role.');
  if (grants.includes('user.manage')) assertOwnerOnly(access, 'Only an owner can grant user administration.');
  const path = requestPath(idempotency.path);
  try {
    return await withTransaction(async (conn) => {
      const reserved = await reserveIdempotency(conn, {
        userId: actor.user.id,
        farmId: access.farmId,
        key: idempotency.key,
        method: idempotency.method,
        path,
      });
      if (reserved.mode === 'replay') return reserved;
      let user = await findUserByEmail(conn, email);
      let userCreated = false;
      if (!user) {
        if (input.password.length < 10) {
          throw new AppError(422, 'VALIDATION_ERROR', 'A temporary password is required for a new person.', {
            fields: { password: 'required' },
          });
        }
        user = await insertUser(conn, {
          email,
          displayName: input.displayName.trim(),
          passwordHash: await hashPassword(input.password),
          preferredLocale: actor.user.preferredLocale,
        });
        userCreated = true;
        await writeAudit(conn, {
          farmId: access.farmId,
          actorUserId: actor.user.id,
          action: 'user.registered',
          entityType: 'user',
          entityId: user.id,
          requestId: actor.requestId,
          summary: { email: user.email },
        });
      }
      const membershipId = await insertMembership(conn, {
        farmId: access.farmId,
        userId: user.id,
        role: input.role,
        createdBy: actor.user.id,
      });
      if (grants.length > 0) await replaceGrants(conn, membershipId, grants, actor.user.id);
      await writeAudit(conn, {
        farmId: access.farmId,
        actorUserId: actor.user.id,
        action: 'membership.created',
        entityType: 'membership',
        entityId: membershipId,
        requestId: actor.requestId,
        summary: { email: user.email, role: input.role, grants },
      });
      const members = await listMembers(conn, access.farmId);
      const member = members.find((item) => item.id === membershipId);
      if (!member) throw new Error('Membership insert failed.');
      const data = { member, userCreated };
      if (reserved.mode === 'new') await finishIdempotency(conn, reserved.id, 201, data);
      return { mode: 'created' as const, status: 201, data };
    });
  } catch (error) {
    if (isDup(error)) throw new AppError(409, 'CONFLICT', 'That person is already on this farm.');
    throw error;
  }
}

export async function createPinMember(actor: Actor, access: FarmAccess, body: unknown, idempotency: IdempotencyInput) {
  const input = pinPersonSchema.parse(body);
  const path = requestPath(idempotency.path);
  try {
    return await withTransaction(async (conn) => {
      const reserved = await reserveIdempotency(conn, {
        userId: actor.user.id,
        farmId: access.farmId,
        key: idempotency.key,
        method: idempotency.method,
        path,
      });
      if (reserved.mode === 'replay') return reserved;
      let user = await findUserByMobile(conn, input.mobile);
      let userCreated = false;
      if (!user) {
        user = await insertPinUser(conn, {
          displayName: input.displayName.trim(),
          mobile: input.mobile,
          pinHash: await hashPassword(input.pin),
          preferredLocale: actor.user.preferredLocale,
        });
        userCreated = true;
        await writeAudit(conn, {
          farmId: access.farmId,
          actorUserId: actor.user.id,
          action: 'user.registered',
          entityType: 'user',
          entityId: user.id,
          requestId: actor.requestId,
          summary: { mobile: input.mobile },
        });
      }
      const membershipId = await insertMembership(conn, {
        farmId: access.farmId,
        userId: user.id,
        role: input.role,
        createdBy: actor.user.id,
      });
      await writeAudit(conn, {
        farmId: access.farmId,
        actorUserId: actor.user.id,
        action: 'membership.created',
        entityType: 'membership',
        entityId: membershipId,
        requestId: actor.requestId,
        summary: { mobile: input.mobile, role: input.role },
      });
      const members = await listMembers(conn, access.farmId);
      const member = members.find((item) => item.id === membershipId);
      if (!member) throw new Error('Membership insert failed.');
      const data = { member, userCreated };
      if (reserved.mode === 'new') await finishIdempotency(conn, reserved.id, 201, data);
      return { mode: 'created' as const, status: 201, data };
    });
  } catch (error) {
    if (isDup(error)) throw new AppError(409, 'CONFLICT', 'That person is already on this farm.');
    throw error;
  }
}

export async function resetMemberPin(actor: Actor, access: FarmAccess, membershipId: string, body: unknown): Promise<MemberRecord> {
  if (!/^[0-9a-f-]{36}$/i.test(membershipId)) throw new AppError(404, 'NOT_FOUND', 'Not found.');
  const input = pinResetSchema.parse(body);
  return withTransaction(async (conn) => {
    const snaps = await listMembershipSnaps(conn, access.farmId, true);
    const current = snaps.find((row) => row.id === membershipId);
    if (!current) throw new AppError(404, 'NOT_FOUND', 'Not found.');
    await updatePinHash(conn, current.userId, await hashPassword(input.pin));
    await revokeAllSessionsExcept(conn, current.userId, null);
    const members = await listMembers(conn, access.farmId);
    const member = members.find((item) => item.id === membershipId);
    if (!member) throw new AppError(404, 'NOT_FOUND', 'Not found.');
    await writeAudit(conn, {
      farmId: access.farmId,
      actorUserId: actor.user.id,
      action: 'auth.pin.reset',
      entityType: 'user',
      entityId: current.userId,
      requestId: actor.requestId,
      summary: { mobile: member.mobile },
    });
    return member;
  });
}

export async function patchMember(actor: Actor, access: FarmAccess, membershipId: string, body: unknown): Promise<MemberRecord> {
  if (!/^[0-9a-f-]{36}$/i.test(membershipId)) throw new AppError(404, 'NOT_FOUND', 'Not found.');
  const input: MembershipUpdateInput = membershipUpdateSchema.parse(body);
  if (input.role === 'owner') assertOwnerOnly(access, 'Only an owner can assign the owner role.');
  if (input.permissionGrants?.includes('user.manage')) {
    assertOwnerOnly(access, 'Only an owner can grant user administration.');
  }
  if (input.role && input.role !== 'family_helper' && input.permissionGrants && input.permissionGrants.length > 0) {
    throw new AppError(422, 'VALIDATION_ERROR', 'Only a family helper can receive extra permissions.', {
      fields: { permissionGrants: 'invalid_format' },
    });
  }
  return withTransaction(async (conn) => {
    const snaps = await listMembershipSnaps(conn, access.farmId, true);
    const current = snaps.find((row) => row.id === membershipId);
    if (!current) throw new AppError(404, 'NOT_FOUND', 'Not found.');
    const nextRole = input.role ?? current.role;
    const nextStatus = input.status ?? current.status;
    const ignoredUserId = input.deactivateUser ? current.userId : null;
    const ownersLeft = snaps.filter((row) => {
      const role = row.id === membershipId ? nextRole : row.role;
      const status = row.id === membershipId ? nextStatus : row.status;
      return status === 'active' && role === 'owner' && row.userId !== ignoredUserId;
    }).length;
    if (ownerCount(snaps) > 0 && ownersLeft < 1) {
      throw new AppError(409, 'LAST_OWNER', 'The farm must keep at least one owner.');
    }
    if (input.deactivateUser) {
      if (current.userId === actor.user.id) {
        throw new AppError(403, 'FORBIDDEN', 'You cannot deactivate your own account.');
      }
      const owned = await findOwnedFarms(conn, current.userId);
      for (const farmId of owned) {
        const others = await countActiveOwners(conn, farmId, current.userId);
        if (others < 1) throw new AppError(409, 'LAST_OWNER', 'The farm must keep at least one owner.');
      }
      await setUserStatus(conn, current.userId, 'deactivated');
      await revokeAllSessionsExcept(conn, current.userId, null);
      const target = await findUserById(conn, current.userId);
      await writeAudit(conn, {
        farmId: access.farmId,
        actorUserId: actor.user.id,
        action: 'user.deactivated',
        entityType: 'user',
        entityId: current.userId,
        requestId: actor.requestId,
        summary: { email: target?.email ?? '' },
      });
    }
    if (input.reactivateUser) {
      await setUserStatus(conn, current.userId, 'active');
      const target = await findUserById(conn, current.userId);
      await writeAudit(conn, {
        farmId: access.farmId,
        actorUserId: actor.user.id,
        action: 'user.reactivated',
        entityType: 'user',
        entityId: current.userId,
        requestId: actor.requestId,
        summary: { email: target?.email ?? '' },
      });
    }
    if (input.role || input.status) {
      await setMembershipRoleStatus(conn, membershipId, {
        ...(input.role ? { role: input.role } : {}),
        ...(input.status ? { status: input.status } : {}),
      });
    }
    if (nextRole !== 'family_helper') {
      await replaceGrants(conn, membershipId, [], actor.user.id);
    } else if (input.permissionGrants) {
      await replaceGrants(conn, membershipId, input.permissionGrants, actor.user.id);
    }
    const members = await listMembers(conn, access.farmId);
    const member = members.find((item) => item.id === membershipId);
    if (!member) throw new AppError(404, 'NOT_FOUND', 'Not found.');
    const action = member.status === 'revoked' && current.status !== 'revoked' ? 'membership.revoked' : 'membership.updated';
    await writeAudit(conn, {
      farmId: access.farmId,
      actorUserId: actor.user.id,
      action,
      entityType: 'membership',
      entityId: membershipId,
      requestId: actor.requestId,
      summary: { email: member.email, role: member.role, status: member.status, grants: member.grants },
    });
    return member;
  });
}

export async function getAudit(farmId: string, limit: number, offset: number) {
  const farm = await findFarmById(pool, farmId, false);
  if (!farm) throw new AppError(404, 'NOT_FOUND', 'Not found.');
  const page = await listAudit(pool, farmId, limit, offset);
    return { timezone: farm.timezone, ...page };
}