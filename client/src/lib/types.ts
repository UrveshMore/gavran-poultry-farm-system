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

export type Sitting = {
  id: string;
  code: string;
  mode: 'incubator' | 'broody_hen';
  incubatorId: string | null;
  incubatorCode: string | null;
  henName: string | null;
  startedOn: string;
  eggCount: number;
  notes: string | null;
  status: 'open' | 'closed';
};

export type HatchRecord = {
  id: string;
  hatchedOn: string;
  eggsSet: number;
  liveChicks: number;
  losses: number;
  otherCount: number;
  differenceNote: string | null;
  chickBatchId: string | null;
  chickBatchCode: string | null;
};

export type ProposedHatchRate = {
  status: 'proposed';
  formula: string;
  liveChicks: number;
  eggsSet: number;
  percent: number | null;
};

export type CandlingRecord = {
  id: string;
  observedOn: string;
  inspectedCount: number;
  notes: string | null;
  lines: Array<{ label: string; eggCount: number }>;
};

export type EggCategory = { id: string; name: string; status: 'active' | 'archived' };

export type TaskSeason = 'summer_heat' | 'monsoon' | 'winter';

export type TaskTemplate = {
  id: string;
  name: string;
  season: TaskSeason | null;
  steps: Array<{ id: string; position: number; body: string; status: 'active' | 'skipped' }>;
};

export type FarmTask = {
  id: string;
  title: string;
  instructions: string | null;
  dueOn: string;
  assigneeUserId: string | null;
  assigneeName: string | null;
  proofRequired: boolean;
  status: 'open' | 'done';
  templateId: string | null;
  templateName: string | null;
  completionNote: string | null;
  completedAt: string | null;
  steps: Array<{ position: number; body: string }>;
  overdue: boolean;
};

export type StockItem = {
  id: string;
  name: string;
  unitLabel: string;
  reorderLevel: number | null;
  notes: string | null;
  onHand: number;
  belowReorder: boolean;
};

export type StockMovement = {
  id: string;
  itemId: string;
  itemName: string;
  unitLabel: string;
  movementType: 'receipt' | 'use' | 'wastage' | 'reversal';
  direction: 'in' | 'out';
  quantity: number;
  occurredOn: string;
  batchId: string | null;
  shedId: string | null;
  lotCode: string | null;
  expiresOn: string | null;
  unitCost: number | null;
  supplierName: string | null;
  reason: string | null;
};

export type WaterRecord = {
  id: string;
  recordedOn: string;
  batchId: string | null;
  shedId: string | null;
  quantity: number | null;
  unitLabel: string | null;
  sourceNote: string | null;
  testNote: string | null;
  notes: string | null;
  laboratoryResult: boolean;
};

export type GrowthTarget = {
  id: string;
  birdTypeId: string;
  birdTypeName: string;
  ageDays: number;
  targetWeight: number;
  weightUnit: 'kg' | 'g';
};

export type Weighing = {
  id: string;
  batchId: string;
  batchCode: string;
  birdTypeId: string;
  weighedOn: string;
  ageDays: number | null;
  weightValue: number;
  weightUnit: 'kg' | 'g';
  birdCount: number | null;
  notes: string | null;
  ownerTarget: { ageDays: number; targetWeight: number; weightUnit: 'kg' | 'g' } | null;
};

export type Incubator = {
  id: string;
  code: string;
  name: string;
  capacityEggs: number | null;
  status: 'in_service' | 'out_of_service';
  notes: string | null;
  version: number;
};

export type IncubatorReading = {
  id: string;
  recordedOn: string;
  recordedTime: string | null;
  temperatureValue: number | null;
  temperatureUnit: string | null;
  humidityValue: number | null;
  humidityUnit: string | null;
  powerStatus: 'on' | 'off' | 'unknown';
  source: 'manual' | 'sensor';
  notes: string | null;
};

export type IncubatorMaintenance = {
  id: string;
  occurredOn: string;
  status: 'in_service' | 'out_of_service';
  notes: string | null;
};

export type EggCollection = {
  id: string;
  collectedOn: string;
  batchId: string | null;
  batchCode: string | null;
  shedId: string | null;
  shedCode: string | null;
  shiftLabel: string | null;
  notes: string | null;
  total: number;
  lines: Array<{ categoryId: string; categoryName: string; eggCount: number }>;
};
