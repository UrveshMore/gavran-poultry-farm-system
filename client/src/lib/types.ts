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

export type BirdType = { id: string; name: string; status: 'active' | 'archived' };

export type Placement = { shedId: string; shedCode: string; shedName: string; birdCount: number };

export type Batch = {
  id: string;
  code: string;
  birdTypeId: string;
  birdTypeName: string;
  sourceNote: string | null;
  hatchDate: string | null;
  openedOn: string;
  status: 'open' | 'closed';
  version: number;
  liveCount: number;
  placements: Placement[];
};

export type BatchMovement = {
  id: string;
  movementType: string;
  fromShedCode: string | null;
  toShedCode: string | null;
  birdCount: number;
  occurredOn: string;
  reason: string | null;
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
