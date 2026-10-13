export type Locale = 'en' | 'hi' | 'mr';
export type FarmRole = 'owner' | 'manager' | 'worker' | 'family_helper' | 'vet_advisor';

export type PublicUser = {
  id: string;
  email: string;
  displayName: string;
  preferredLocale: Locale;
  platformRole: 'system_administrator' | null;
  status: 'active' | 'deactivated';
};

export type FarmSummary = {
  id: string;
  name: string;
  code: string;
  timezone: string;
  locale: Locale;
  role: FarmRole;
  membershipId: string;
  permissions: string[];
};

export type FarmDetail = {
  id: string;
  name: string;
  code: string;
  timezone: string;
  locale: Locale;
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  addressLine: string | null;
  weightUnit: 'kg' | 'g';
  volumeUnit: 'L' | 'mL';
  status: 'active' | 'archived';
  version: number;
  shedCount: number;
  memberCount: number;
  role: FarmRole;
  permissions: string[];
};

export type Shed = {
  id: string;
  farmId: string;
  code: string;
  name: string;
  shedType: string;
  usableCapacity: number;
  capacityUnit: string;
  status: 'active' | 'inactive' | 'maintenance';
  notes: string | null;
  version: number;
};

export type Member = {
  id: string;
  userId: string;
  email: string;
  displayName: string;
  role: FarmRole;
  status: 'active' | 'revoked';
  userStatus: 'active' | 'deactivated';
  grants: string[];
};

export type AuditItem = {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  summary: Record<string, unknown>;
  createdAt: string;
  requestId: string;
  actorName: string | null;
};

export type AuditPage = {
  timezone: string;
  items: AuditItem[];
  total: number;
};
