import { randomUUID } from 'node:crypto';
import type { RowDataPacket } from 'mysql2/promise';
import {
  isFarmRole,
  isPermission,
  type FarmRole,
  type Locale,
  type PermissionCode,
  type ShedStatus,
  type ShedType,
  type VolumeUnit,
  type WeightUnit,
} from '@gavran/shared';
import { asNumber, exec, many, one, type Db } from '../../db/sql.js';

export type FarmRecord = {
  id: string;
  name: string;
  code: string;
  timezone: string;
  locale: Locale;
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  addressLine: string | null;
  weightUnit: WeightUnit;
  volumeUnit: VolumeUnit;
  status: 'active' | 'archived';
  version: number;
  shedCount: number;
  memberCount: number;
};

type FarmRow = RowDataPacket & {
  id: string;
  name: string;
  code: string;
  timezone: string;
  locale: Locale;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  address_line: string | null;
  weight_unit: WeightUnit;
  volume_unit: VolumeUnit;
  status: 'active' | 'archived';
  version: number;
};

function mapFarm(row: FarmRow, shedCount: number, memberCount: number): FarmRecord {
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    timezone: row.timezone,
    locale: row.locale,
    contactName: row.contact_name,
    contactPhone: row.contact_phone,
    contactEmail: row.contact_email,
    addressLine: row.address_line,
    weightUnit: row.weight_unit,
    volumeUnit: row.volume_unit,
    status: row.status,
    version: Number(row.version),
    shedCount,
    memberCount,
  };
}

const FARM_SELECT = `
  SELECT id, name, code, timezone, locale, contact_name, contact_phone, contact_email,
         address_line, weight_unit, volume_unit, status, version
  FROM farms
`;

export async function insertFarm(
  db: Db,
  input: Omit<FarmRecord, 'id' | 'status' | 'version' | 'shedCount' | 'memberCount'> & { createdBy: string },
): Promise<FarmRecord> {
  const id = randomUUID();
  await exec(
    db,
    `INSERT INTO farms
      (id, name, code, timezone, locale, contact_name, contact_phone, contact_email, address_line,
       weight_unit, volume_unit, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.name,
      input.code,
      input.timezone,
      input.locale,
      input.contactName,
      input.contactPhone,
      input.contactEmail,
      input.addressLine,
      input.weightUnit,
      input.volumeUnit,
      input.createdBy,
    ],
  );
  const created = await findFarmById(db, id, false);
  if (!created) throw new Error('Farm insert failed.');
  return created;
}

async function countForFarm(db: Db, farmId: string): Promise<{ sheds: number; members: number }> {
  const sheds = await one<RowDataPacket & { n: number | string | bigint }>(
    db,
    'SELECT COUNT(*) AS n FROM sheds WHERE farm_id = ?',
    [farmId],
  );
  const members = await one<RowDataPacket & { n: number | string | bigint }>(
    db,
    `SELECT COUNT(*) AS n FROM farm_memberships WHERE farm_id = ? AND status = 'active'`,
    [farmId],
  );
  return { sheds: sheds ? asNumber(sheds.n) : 0, members: members ? asNumber(members.n) : 0 };
}

export async function findFarmById(db: Db, id: string, lock: boolean): Promise<FarmRecord | null> {
  const row = await one<FarmRow>(db, `${FARM_SELECT} WHERE id = ?${lock ? ' FOR UPDATE' : ''}`, [id]);
  if (!row) return null;
  const counts = await countForFarm(db, id);
  return mapFarm(row, counts.sheds, counts.members);
}

export type FarmPatch = Partial<{
  name: string;
  code: string;
  timezone: string;
  locale: Locale;
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  addressLine: string | null;
  weightUnit: WeightUnit;
  volumeUnit: VolumeUnit;
}>;

const FARM_COLUMNS: Record<keyof FarmPatch, string> = {
  name: 'name',
  code: 'code',
  timezone: 'timezone',
  locale: 'locale',
  contactName: 'contact_name',
  contactPhone: 'contact_phone',
  contactEmail: 'contact_email',
  addressLine: 'address_line',
  weightUnit: 'weight_unit',
  volumeUnit: 'volume_unit',
};

export async function updateFarm(db: Db, farmId: string, version: number, patch: FarmPatch): Promise<boolean> {
  const sets: string[] = [];
  const params: Array<string | number | Date | null> = [];
  for (const key of Object.keys(FARM_COLUMNS) as Array<keyof FarmPatch>) {
    if (patch[key] !== undefined) {
      sets.push(`${FARM_COLUMNS[key]} = ?`);
      params.push(patch[key] ?? null);
    }
  }
  if (sets.length === 0) return false;
  sets.push('version = version + 1');
  params.push(farmId, version);
  const result = await exec(db, `UPDATE farms SET ${sets.join(', ')} WHERE id = ? AND version = ?`, params);
  return result.affectedRows === 1;
}

export type MembershipSnap = {
  id: string;
  userId: string;
  role: FarmRole;
  status: 'active' | 'revoked';
};

export async function listMembershipSnaps(db: Db, farmId: string, lock: boolean): Promise<MembershipSnap[]> {
  const rows = await many<RowDataPacket & { id: string; user_id: string; role_code: string; status: 'active' | 'revoked' }>(
    db,
    `SELECT m.id, m.user_id, r.code AS role_code, m.status
     FROM farm_memberships m
     JOIN roles r ON r.id = m.role_id
     WHERE m.farm_id = ?${lock ? ' FOR UPDATE' : ''}`,
    [farmId],
  );
  return rows.flatMap((row) => {
    if (!isFarmRole(row.role_code)) return [];
    return [{ id: row.id, userId: row.user_id, role: row.role_code, status: row.status }];
  });
}

export async function insertMembership(
  db: Db,
  input: { farmId: string; userId: string; role: FarmRole; createdBy: string },
): Promise<string> {
  const id = randomUUID();
  const result = await exec(
    db,
    `INSERT INTO farm_memberships (id, farm_id, user_id, role_id, created_by)
     SELECT ?, ?, ?, r.id, ? FROM roles r WHERE r.code = ?`,
    [id, input.farmId, input.userId, input.createdBy, input.role],
  );
  if (result.affectedRows !== 1) {
    throw new Error('Could not create membership.');
  }
  return id;
}

export async function replaceGrants(
  db: Db,
  membershipId: string,
  grants: readonly PermissionCode[],
  grantedBy: string,
): Promise<void> {
  await exec(db, 'DELETE FROM membership_permission_grants WHERE membership_id = ?', [membershipId]);
  for (const code of grants) {
    await exec(
      db,
      `INSERT INTO membership_permission_grants (membership_id, permission_id, granted_by)
       SELECT ?, p.id, ? FROM permissions p WHERE p.code = ?`,
      [membershipId, grantedBy, code],
    );
  }
}

export async function setMembershipRoleStatus(
  db: Db,
  membershipId: string,
  patch: { role?: FarmRole; status?: 'active' | 'revoked' },
): Promise<void> {
  if (patch.role) {
    await exec(
      db,
      `UPDATE farm_memberships m
       JOIN roles r ON r.code = ?
       SET m.role_id = r.id
       WHERE m.id = ?`,
      [patch.role, membershipId],
    );
  }
  if (patch.status) {
    await exec(db, 'UPDATE farm_memberships SET status = ? WHERE id = ?', [patch.status, membershipId]);
  }
}

export type FarmListItem = {
  id: string;
  name: string;
  code: string;
  timezone: string;
  locale: Locale;
  role: FarmRole;
  membershipId: string;
  permissions: PermissionCode[];
};

export async function listFarmsForUser(db: Db, userId: string): Promise<FarmListItem[]> {
  const farms = await many<
    RowDataPacket & {
      id: string;
      name: string;
      code: string;
      timezone: string;
      locale: Locale;
      role_code: string;
      membership_id: string;
    }
  >(
    db,
    `SELECT f.id, f.name, f.code, f.timezone, f.locale, r.code AS role_code, m.id AS membership_id
     FROM farm_memberships m
     JOIN farms f ON f.id = m.farm_id
     JOIN roles r ON r.id = m.role_id
     WHERE m.user_id = ? AND m.status = 'active'
     ORDER BY f.name`,
    [userId],
  );
  const permRows = await many<RowDataPacket & { membership_id: string; code: string }>(
    db,
    `SELECT m.id AS membership_id, p.code
     FROM farm_memberships m
     JOIN role_permissions rp ON rp.role_id = m.role_id
     JOIN permissions p ON p.id = rp.permission_id
     WHERE m.user_id = ? AND m.status = 'active'
     UNION
     SELECT m.id, p.code
     FROM farm_memberships m
     JOIN roles r ON r.id = m.role_id AND r.code = 'family_helper'
     JOIN membership_permission_grants g ON g.membership_id = m.id
     JOIN permissions p ON p.id = g.permission_id
     WHERE m.user_id = ? AND m.status = 'active'`,
    [userId, userId],
  );
  const byMembership = new Map<string, PermissionCode[]>();
  for (const row of permRows) {
    if (!isPermission(row.code)) continue;
    const list = byMembership.get(row.membership_id) ?? [];
    list.push(row.code);
    byMembership.set(row.membership_id, list);
  }
  return farms.flatMap((farm) => {
    if (!isFarmRole(farm.role_code)) return [];
    return [
      {
        id: farm.id,
        name: farm.name,
        code: farm.code,
        timezone: farm.timezone,
        locale: farm.locale,
        role: farm.role_code,
        membershipId: farm.membership_id,
        permissions: byMembership.get(farm.membership_id) ?? [],
      },
    ];
  });
}

export async function loadAccess(
  db: Db,
  userId: string,
  farmId: string,
): Promise<{ farmId: string; membershipId: string; role: FarmRole; permissions: PermissionCode[] } | null> {
  const farms = await listFarmsForUser(db, userId);
  const farm = farms.find((item) => item.id === farmId);
  if (!farm) return null;
  return {
    farmId: farm.id,
    membershipId: farm.membershipId,
    role: farm.role,
    permissions: farm.permissions,
  };
}

export type ShedRecord = {
  id: string;
  farmId: string;
  code: string;
  name: string;
  shedType: ShedType;
  usableCapacity: number;
  capacityUnit: string;
  status: ShedStatus;
  notes: string | null;
  version: number;
};

type ShedRow = RowDataPacket & {
  id: string;
  farm_id: string;
  code: string;
  name: string;
  shed_type: ShedType;
  usable_capacity: number;
  capacity_unit: string;
  status: ShedStatus;
  notes: string | null;
  version: number;
};

function mapShed(row: ShedRow): ShedRecord {
  return {
    id: row.id,
    farmId: row.farm_id,
    code: row.code,
    name: row.name,
    shedType: row.shed_type,
    usableCapacity: Number(row.usable_capacity),
    capacityUnit: row.capacity_unit,
    status: row.status,
    notes: row.notes,
    version: Number(row.version),
  };
}

export async function insertShed(
  db: Db,
  input: Omit<ShedRecord, 'id' | 'version'> & { createdBy: string },
): Promise<ShedRecord> {
  const id = randomUUID();
  await exec(
    db,
    `INSERT INTO sheds
      (id, farm_id, code, name, shed_type, usable_capacity, capacity_unit, status, notes, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.farmId,
      input.code,
      input.name,
      input.shedType,
      input.usableCapacity,
      input.capacityUnit,
      input.status,
      input.notes,
      input.createdBy,
    ],
  );
  const created = await findShed(db, input.farmId, id, false);
  if (!created) throw new Error('Shed insert failed.');
  return created;
}

export async function listSheds(db: Db, farmId: string): Promise<ShedRecord[]> {
  const rows = await many<ShedRow>(
    db,
    `SELECT id, farm_id, code, name, shed_type, usable_capacity, capacity_unit, status, notes, version
     FROM sheds WHERE farm_id = ? ORDER BY code`,
    [farmId],
  );
  return rows.map(mapShed);
}

export async function findShed(db: Db, farmId: string, shedId: string, lock: boolean): Promise<ShedRecord | null> {
  const row = await one<ShedRow>(
    db,
    `SELECT id, farm_id, code, name, shed_type, usable_capacity, capacity_unit, status, notes, version
     FROM sheds WHERE farm_id = ? AND id = ?${lock ? ' FOR UPDATE' : ''}`,
    [farmId, shedId],
  );
  return row ? mapShed(row) : null;
}

export type ShedPatch = Partial<{
  code: string;
  name: string;
  shedType: ShedType;
  usableCapacity: number;
  status: ShedStatus;
  notes: string | null;
}>;

const SHED_COLUMNS: Record<keyof ShedPatch, string> = {
  code: 'code',
  name: 'name',
  shedType: 'shed_type',
  usableCapacity: 'usable_capacity',
  status: 'status',
  notes: 'notes',
};

export async function updateShed(db: Db, farmId: string, shedId: string, version: number, patch: ShedPatch): Promise<boolean> {
  const sets: string[] = [];
  const params: Array<string | number | Date | null> = [];
  for (const key of Object.keys(SHED_COLUMNS) as Array<keyof ShedPatch>) {
    if (patch[key] !== undefined) {
      sets.push(`${SHED_COLUMNS[key]} = ?`);
      params.push(patch[key] ?? null);
    }
  }
  if (sets.length === 0) return false;
  sets.push('version = version + 1');
  params.push(farmId, shedId, version);
  const result = await exec(
    db,
    `UPDATE sheds SET ${sets.join(', ')} WHERE farm_id = ? AND id = ? AND version = ?`,
    params,
  );
  return result.affectedRows === 1;
}

export type MemberRecord = {
  id: string;
  userId: string;
  email: string | null;
  mobile: string | null;
  displayName: string;
  role: FarmRole;
  status: 'active' | 'revoked';
  userStatus: 'active' | 'deactivated';
  grants: PermissionCode[];
};

export async function listMembers(db: Db, farmId: string): Promise<MemberRecord[]> {
  const rows = await many<
    RowDataPacket & {
      id: string;
      user_id: string;
      email: string | null;
      mobile: string | null;
      display_name: string;
      role_code: string;
      status: 'active' | 'revoked';
      user_status: 'active' | 'deactivated';
      permission_code: string | null;
    }
  >(
    db,
    `SELECT m.id, u.id AS user_id, u.email, u.mobile, u.display_name, u.status AS user_status,
            r.code AS role_code, m.status, p.code AS permission_code
     FROM farm_memberships m
     JOIN users u ON u.id = m.user_id
     JOIN roles r ON r.id = m.role_id
     LEFT JOIN membership_permission_grants g ON g.membership_id = m.id
     LEFT JOIN permissions p ON p.id = g.permission_id
     WHERE m.farm_id = ?
     ORDER BY u.display_name, m.id`,
    [farmId],
  );
  const grouped = new Map<string, MemberRecord>();
  for (const row of rows) {
    if (!isFarmRole(row.role_code)) continue;
    let member = grouped.get(row.id);
    if (!member) {
      member = {
        id: row.id,
        userId: row.user_id,
        email: row.email,
        mobile: row.mobile,
        displayName: row.display_name,
        role: row.role_code,
        status: row.status,
        userStatus: row.user_status,
        grants: [],
      };
      grouped.set(row.id, member);
    }
    if (row.permission_code && isPermission(row.permission_code) && !member.grants.includes(row.permission_code)) {
      member.grants.push(row.permission_code);
    }
  }
  return [...grouped.values()];
}

export async function findOwnedFarms(db: Db, userId: string): Promise<string[]> {
  const rows = await many<RowDataPacket & { farm_id: string }>(
    db,
    `SELECT m.farm_id
     FROM farm_memberships m
     JOIN roles r ON r.id = m.role_id
     WHERE m.user_id = ? AND m.status = 'active' AND r.code = 'owner'`,
    [userId],
  );
  return rows.map((row) => row.farm_id);
}

export async function countActiveOwners(db: Db, farmId: string, ignoreUserId: string | null): Promise<number> {
  const row = await one<RowDataPacket & { n: number | string | bigint }>(
    db,
    `SELECT COUNT(*) AS n
     FROM farm_memberships m
     JOIN roles r ON r.id = m.role_id
     WHERE m.farm_id = ? AND m.status = 'active' AND r.code = 'owner' AND (? IS NULL OR m.user_id <> ?)`,
    [farmId, ignoreUserId, ignoreUserId],
  );
  return row ? asNumber(row.n) : 0;
}
