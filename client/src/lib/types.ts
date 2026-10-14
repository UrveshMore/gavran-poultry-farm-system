export type Locale = 'en' | 'hi' | 'mr';
export type FarmRole = 'owner' | 'manager' | 'worker' | 'family_helper' | 'vet_advisor';

export type PublicUser = {
  id: string;
  email: string | null;
  mobile: string | null;
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
  email: string | null;
  mobile: string | null;
  displayName: string;
  role: FarmRole;
  status: 'active' | 'revoked';
  userStatus: 'active' | 'deactivated';
  grants: string[];
};

export type BirdType = { id: string; name: string; strainNote: string | null; status: 'active' | 'archived' };

export type Placement = { shedId: string; shedCode: string; shedName: string; birdCount: number };
export type RangePlacement = { rangeAreaId: string; name: string; birdCount: number };
export type RangeArea = { id: string; name: string; notes: string | null };
export type SexCount = {
  id: string;
  countedOn: string;
  batchId: string | null;
  batchCode: string | null;
  roosterCount: number;
  henCount: number;
  ratio: { roosters: number; hens: number };
};

export type Batch = {
  id: string;
  code: string;
  birdTypeId: string;
  birdTypeName: string;
  sourceNote: string | null;
  hatchDate: string | null;
  eggSetOn?: string | null;
  openedOn: string;
  status: 'open' | 'closed';
  version: number;
  liveCount: number;
  placements: Placement[];
  rangePlacements: RangePlacement[];
};

export type BatchMovement = {
  id: string;
  movementType: string;
  fromShedCode: string | null;
  toShedCode: string | null;
  fromRangeName: string | null;
  toRangeName: string | null;
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

export type EggCategory = { id: string; name: string; status: 'active' | 'archived'; purpose?: 'incubator' | 'sale' | 'eaten' | 'broken' | null };

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

export type KnowledgeEntry = {
  id: string;
  sourceFile: string;
  sourcePage: number;
  title: string;
  kind: 'disease' | 'medicine' | 'care';
  textLayer: string;
  usedFor: string;
  symptoms: string;
  howToGive: string;
  scheduleText: string;
  precautions: string;
  mustVerify: true;
  verifyLabel: string;
  approved: boolean;
  verificationNote: string | null;
};

export type HealthObservation = {
  id: string;
  observedOn: string;
  batchId: string | null;
  birdCount: number | null;
  notes: string;
  entryId: string | null;
  entryTitle: string | null;
};

export type MedicineRecord = {
  id: string;
  entryId: string;
  entryTitle: string;
  givenOn: string;
  batchId: string | null;
  notes: string;
};

export type BiosecurityStep = {
  id: string;
  body: string;
  origin: 'owner' | 'pdf';
  sourceFile: string | null;
  sourcePage: number | null;
  approved: boolean;
  mustVerify: boolean;
};

export type YardNote = {
  id: string;
  notedOn: string;
  kind: 'note' | 'let_out' | 'shut_in';
  notedTime: string | null;
  body: string;
};

export type YardPage = { notes: YardNote[]; today: string };

export type LossIncident = {
  id: string;
  occurredOn: string;
  birdCount: number;
  note: string;
  movementId: string | null;
  batchCode: string | null;
};

export type Customer = { id: string; name: string; phone: string | null; notes: string | null };
export type MarketPrice = { id: string; itemName: string; amount: number; unitLabel: string; effectiveOn: string };
export type FarmOrder = {
  id: string;
  customerId: string;
  customerName: string;
  orderedOn: string;
  status: 'draft';
  lines: Array<{ description: string; quantity: number; unitPrice: number }>;
};
export type OrdersPage = { orders: FarmOrder[]; invoicePosting: 'disabled' };

export type ExpenseCategory = { id: string; name: string };
export type ExpenseEntry = {
  id: string;
  occurredOn: string;
  direction: 'expense' | 'income';
  categoryId: string;
  categoryName: string;
  amount: number;
  unitLabel: string;
  counterparty: string | null;
  referenceNote: string | null;
  notes: string | null;
  batchId: string | null;
  batchCode: string | null;
  reversesEntryId: string | null;
  reversedById: string | null;
};
export type ExpensesPageData = {
  categories: ExpenseCategory[];
  entries: ExpenseEntry[];
  accountingBasis: { status: 'not_chosen'; reason: string };
};

export type ReportSection =
  | {
      id: 'movements';
      sourceTable: string;
      formula: { status: 'ledger'; text: string };
      rows: Array<{ id: string; occurredOn: string; movementType: string; birdCount: number; batchCode: string }>;
    }
  | {
      id: 'eggs';
      sourceTable: string;
      formula: { status: 'sum'; text: string };
      total: number;
      rows: Array<{ id: string; collectedOn: string; eggCount: number }>;
    }
  | {
      id: 'hatches';
      sourceTable: string;
      formula: { status: 'proposed'; text: string };
      rows: Array<{ id: string; hatchedOn: string; eggsSet: number; liveChicks: number; proposedHatchRate: { status: 'proposed'; formula: string; percent: number | null } }>;
    }
  | {
      id: 'losses';
      sourceTable: string;
      formula: { status: 'not_calculated'; reason: string };
      rows: Array<{ id: string; occurredOn: string; birdCount: number; note: string }>;
    }
  | {
      id: 'expenses';
      sourceTable: string;
      formula: { status: 'not_chosen'; reason: string };
      listedSums: Array<{ direction: 'expense' | 'income'; unitLabel: string; amount: number }>;
      rows: Array<{ id: string; occurredOn: string; direction: 'expense' | 'income'; amount: number; unitLabel: string }>;
    }
  | {
      id: 'attendance';
      sourceTable: string;
      formula: { status: 'row_count'; text: string };
      rowCount: number;
      rows: Array<{ id: string; attendedOn: string; methodLabel: string }>;
    }
  | {
      id: 'parentage';
      sourceTable: string;
      formula: { status: 'unset'; text: string };
      rows: Array<{ id: string; recordedOn: string; sireNote: string; damNote: string }>;
    }
  | {
      id: 'receipts';
      sourceTable: string;
      formula: { status: 'not_posted'; text: string };
      rows: Array<{ id: string; receivedOn: string; acceptedQuantity: number; rejectedQuantity: number; unitLabel: string }>;
    }
  | {
      id: 'invoiceDocuments';
      sourceTable: string;
      formula: { status: 'unposted'; text: string };
      rows: Array<{ id: string; issuedOn: string; status: 'unposted' }>;
    }
  | {
      id: 'returns';
      sourceTable: string;
      formula: { status: 'listed'; text: string };
      rows: Array<{ id: string; returnedOn: string; description: string; quantity: number }>;
    };

export type FarmReport = {
  from: string;
  to: string;
  filters: { shedId: string; batchId: string; categoryId: string };
  timezone: string;
  generatedAt: string;
  offlinePending: 'none';
  sections: ReportSection[];
};

export type Safeguards = {
  retention: { status: 'not_chosen'; reason: string };
  recovery: { rpo: null; rto: null; reason: string };
  backup: { schedule: 'not_chosen'; offsiteCopy: 'not_chosen'; isolatedDatabase: string };
};

export type LossPage = {
  incidents: LossIncident[];
  mortalityMovements: Array<{ id: string; occurredOn: string; birdCount: number; batchCode: string; reason: string | null }>;
  proposedMortalityRate: { status: 'not_calculated'; reason: string };
  today: string;
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

export type AttendancePage = {
  records: Array<{
    id: string;
    userId: string;
    displayName: string;
    attendedOn: string;
    attendedTime: string | null;
    methodLabel: string;
    note: string;
  }>;
  metric: { kind: 'row_count'; rowCount: number };
};

export type TrainingItem = { id: string; title: string; body: string; versionLabel: string };

export type TrainingAssignment = {
  id: string;
  itemId: string;
  itemTitle: string;
  versionLabel: string;
  userId: string;
  displayName: string;
  dueOn: string | null;
  completionId: string | null;
  completionNote: string | null;
};

export type SupplierPage = {
  suppliers: Array<{ id: string; name: string; contactName: string; phone: string; notes: string }>;
  orders: Array<{
    id: string;
    supplierId: string;
    supplierName: string;
    orderedOn: string;
    status: 'draft';
    notes: string;
    lines: Array<{ id: string; description: string; quantity: number; unitLabel: string; unitPrice: number | null; priceUnit: string | null }>;
  }>;
  receipts: Array<{
    id: string;
    supplierName: string;
    receivedOn: string;
    acceptedQuantity: number;
    rejectedQuantity: number;
    unitLabel: string;
    note: string;
  }>;
  bills: Array<{ id: string; supplierName: string; occurredOn: string; amount: number; unitLabel: string; referenceNote: string; notes: string }>;
  payments: Array<{ id: string; supplierName: string; occurredOn: string; amount: number; unitLabel: string; referenceNote: string; notes: string }>;
  stockPosting: 'disabled';
  valuation: { status: 'not_chosen'; reason: string };
};

export type ParentagePage = {
  records: Array<{
    id: string;
    recordedOn: string;
    offspringBatchId: string | null;
    offspringCode: string | null;
    sireNote: string;
    damNote: string;
    sireBatchId: string | null;
    sireCode: string | null;
    damBatchId: string | null;
    damCode: string | null;
    note: string;
  }>;
  pairing: { status: 'unset' };
};

export type TrainingPage = {
  items: TrainingItem[];
  assignments: TrainingAssignment[];
  requirements: Array<{ id: string; taskId: string; taskTitle: string; itemId: string; itemTitle: string }>;
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
  lines: Array<{ categoryId: string; categoryName: string; eggCount: number; purpose?: 'incubator' | 'sale' | 'eaten' | 'broken' | null }>;
};
