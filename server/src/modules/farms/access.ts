import type { FarmRole, PermissionCode } from '@gavran/shared';

export type FarmAccess = {
  farmId: string;
  membershipId: string;
  role: FarmRole;
  permissions: PermissionCode[];
};
