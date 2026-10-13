export const LOCALES = ['en', 'hi', 'mr'] as const;
export type Locale = (typeof LOCALES)[number];

export const FARM_ROLES = ['owner', 'manager', 'worker', 'family_helper', 'vet_advisor'] as const;
export type FarmRole = (typeof FARM_ROLES)[number];

export const PLATFORM_ROLES = ['system_administrator'] as const;
export type PlatformRole = (typeof PLATFORM_ROLES)[number];

export const PERMISSIONS = [
  'farm.read',
  'farm.update',
  'shed.read',
  'shed.create',
  'shed.update',
  'user.read',
  'user.manage',
  'audit.read',
  'batch.read',
  'batch.create',
  'movement.create',
  'egg.read',
  'egg.record',
  'incubator.read',
  'incubator.record',
  'incubator.manage',
  'incubation.read',
  'incubation.record',
  'hatch.record',
] as const;
export type PermissionCode = (typeof PERMISSIONS)[number];

export const SHED_TYPES = ['brooder', 'grower', 'layer', 'breeder', 'quarantine', 'storage', 'other'] as const;
export type ShedType = (typeof SHED_TYPES)[number];

export const SHED_STATUSES = ['active', 'inactive', 'maintenance'] as const;
export type ShedStatus = (typeof SHED_STATUSES)[number];

export const WEIGHT_UNITS = ['kg', 'g'] as const;
export type WeightUnit = (typeof WEIGHT_UNITS)[number];

export const VOLUME_UNITS = ['L', 'mL'] as const;
export type VolumeUnit = (typeof VOLUME_UNITS)[number];

export const CAPACITY_UNIT = 'birds' as const;

export const BATCH_STATUSES = ['open', 'closed'] as const;
export type BatchStatus = (typeof BATCH_STATUSES)[number];

/** User-posted movements. The opening placement is created with the batch. */
export const MOVEMENT_TYPES = ['transfer', 'sale', 'mortality', 'culling', 'other_exit'] as const;
export type MovementType = (typeof MOVEMENT_TYPES)[number];

/**
 * Provisional Phase 1 matrix. Family helpers receive nothing from the role.
 * System administrators are not a farm role and receive no business permissions.
 * Confirm with the farm owner before production use.
 */
export const ROLE_PERMISSIONS: Record<FarmRole | PlatformRole, readonly PermissionCode[]> = {
  owner: PERMISSIONS,
  manager: ['farm.read', 'shed.read', 'shed.create', 'shed.update', 'user.read', 'audit.read', 'batch.read', 'batch.create', 'movement.create', 'egg.read', 'egg.record', 'incubator.read', 'incubator.record', 'incubator.manage', 'incubation.read', 'incubation.record', 'hatch.record'],
  worker: ['farm.read', 'shed.read', 'batch.read', 'egg.read', 'egg.record', 'incubator.read', 'incubator.record', 'incubation.read', 'incubation.record', 'hatch.record'],
  family_helper: [],
  vet_advisor: ['farm.read', 'shed.read', 'batch.read', 'egg.read', 'incubator.read', 'incubation.read'],
  system_administrator: [],
};

export function isPermission(value: string): value is PermissionCode {
  return (PERMISSIONS as readonly string[]).includes(value);
}

export function isFarmRole(value: string): value is FarmRole {
  return (FARM_ROLES as readonly string[]).includes(value);
}

export function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}
