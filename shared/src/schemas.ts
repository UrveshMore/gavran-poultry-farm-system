import { z } from 'zod';
import {
  FARM_ROLES,
  LOCALES,
  MOVEMENT_TYPES,
  PERMISSIONS,
  SHED_STATUSES,
  SHED_TYPES,
  STOCK_DIRECTIONS,
  STOCK_MOVEMENT_TYPES,
  TASK_SEASONS,
  VOLUME_UNITS,
  WEIGHT_UNITS,
} from './permissions.js';
import { isIanaTimeZone } from './time.js';

export const passwordSchema = z.string().min(10, 'too_small').max(128, 'too_big');

export const emailSchema = z
  .string()
  .trim()
  .min(3, 'too_small')
  .max(255, 'too_big')
  .email('invalid_format');

export const displayNameSchema = z
  .string()
  .trim()
  .min(2, 'too_small')
  .max(120, 'too_big')
  .refine((value) => !/[\u0000-\u001F]/.test(value), 'invalid_format');

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  displayName: displayNameSchema,
  preferredLocale: z.enum(LOCALES),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'required').max(128, 'too_big'),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'required').max(128, 'too_big'),
    newPassword: passwordSchema,
  })
  .refine((value) => value.currentPassword !== value.newPassword, {
    message: 'different',
    path: ['newPassword'],
  });

export const profileSchema = z
  .object({
    displayName: displayNameSchema.optional(),
    preferredLocale: z.enum(LOCALES).optional(),
  })
  .refine((value) => value.displayName !== undefined || value.preferredLocale !== undefined, {
    message: 'required',
    path: ['form'],
  });

export const farmInputSchema = z.object({
  name: z.string().trim().min(2, 'too_small').max(160, 'too_big'),
  code: z
    .string()
    .trim()
    .min(2, 'too_small')
    .max(32, 'too_big')
    .regex(/^[A-Za-z0-9][A-Za-z0-9_-]*$/, 'invalid_format'),
  timezone: z.string().trim().min(1, 'required').max(64, 'too_big').refine(isIanaTimeZone, 'invalid_format'),
  locale: z.enum(LOCALES),
  contactName: z.string().trim().max(120, 'too_big'),
  contactPhone: z
    .string()
    .trim()
    .max(32, 'too_big')
    .refine((value) => value === '' || /^[0-9+\-().\s]{6,32}$/.test(value), 'invalid_format'),
  contactEmail: z
    .string()
    .trim()
    .max(255, 'too_big')
    .refine((value) => value === '' || z.string().email().safeParse(value).success, 'invalid_format'),
  addressLine: z.string().trim().max(255, 'too_big'),
  weightUnit: z.enum(WEIGHT_UNITS),
  volumeUnit: z.enum(VOLUME_UNITS),
});

export const farmUpdateSchema = farmInputSchema
  .partial()
  .extend({
    version: z.number({ invalid_type_error: 'invalid_format' }).int('invalid_format').positive('too_small'),
  })
  .refine((value) => Object.keys(value).some((key) => key !== 'version'), {
    message: 'required',
    path: ['form'],
  });

export const shedInputSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, 'too_small')
    .max(32, 'too_big')
    .regex(/^[A-Za-z0-9][A-Za-z0-9_-]*$/, 'invalid_format'),
  name: z.string().trim().min(2, 'too_small').max(120, 'too_big'),
  shedType: z.enum(SHED_TYPES),
  usableCapacity: z
    .number({ invalid_type_error: 'invalid_format' })
    .int('invalid_format')
    .min(0, 'too_small')
    .max(1_000_000, 'too_big'),
  status: z.enum(SHED_STATUSES),
  notes: z.string().trim().max(1000, 'too_big'),
});

export const shedUpdateSchema = shedInputSchema
  .partial()
  .extend({
    version: z.number({ invalid_type_error: 'invalid_format' }).int('invalid_format').positive('too_small'),
  })
  .refine((value) => Object.keys(value).some((key) => key !== 'version'), {
    message: 'required',
    path: ['form'],
  });

export const inviteSchema = z
  .object({
    email: emailSchema,
    displayName: displayNameSchema,
    password: z.string().max(128, 'too_big'),
    role: z.enum(FARM_ROLES),
    permissionGrants: z.array(z.enum(PERMISSIONS)).max(PERMISSIONS.length),
  })
  .superRefine((value, ctx) => {
    if (value.role !== 'family_helper' && value.permissionGrants.length > 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'invalid_format', path: ['permissionGrants'] });
    }
    if (value.password !== '' && value.password.length < 10) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'too_small', path: ['password'] });
    }
  });

export const membershipUpdateSchema = z
  .object({
    role: z.enum(FARM_ROLES).optional(),
    status: z.enum(['active', 'revoked']).optional(),
    permissionGrants: z.array(z.enum(PERMISSIONS)).max(PERMISSIONS.length).optional(),
    deactivateUser: z.boolean().optional(),
    reactivateUser: z.boolean().optional(),
  })
  .refine((value) => !(value.deactivateUser && value.reactivateUser), {
    message: 'invalid_format',
    path: ['form'],
  })
  .refine(
    (value) =>
      value.role !== undefined ||
      value.status !== undefined ||
      value.permissionGrants !== undefined ||
      value.deactivateUser === true ||
      value.reactivateUser === true,
    { message: 'required', path: ['form'] },
  );

function isRealDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export const calendarDateSchema = z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, 'invalid_format').refine(isRealDate, 'invalid_format');

export const birdTypeInputSchema = z.object({
  name: z.string().trim().min(2, 'too_small').max(80, 'too_big'),
});

export const batchInputSchema = z
  .object({
    code: z
      .string()
      .trim()
      .min(1, 'too_small')
      .max(32, 'too_big')
      .regex(/^[A-Za-z0-9][A-Za-z0-9_-]*$/, 'invalid_format'),
    birdTypeId: z.string().uuid('invalid_format'),
    sourceNote: z.string().trim().max(255, 'too_big'),
    hatchDate: z.union([calendarDateSchema, z.literal('')]),
    openedOn: calendarDateSchema,
    shedId: z.string().uuid('invalid_format'),
    birdCount: z.number({ invalid_type_error: 'invalid_format' }).int('invalid_format').min(1, 'too_small').max(1_000_000, 'too_big'),
  })
  .refine((value) => value.hatchDate === '' || value.hatchDate <= value.openedOn, {
    message: 'invalid_format',
    path: ['hatchDate'],
  });

export const movementInputSchema = z
  .object({
    movementType: z.enum(MOVEMENT_TYPES),
    fromShedId: z.string().uuid('invalid_format'),
    toShedId: z.union([z.string().uuid('invalid_format'), z.literal('')]),
    birdCount: z.number({ invalid_type_error: 'invalid_format' }).int('invalid_format').min(1, 'too_small').max(1_000_000, 'too_big'),
    occurredOn: calendarDateSchema,
    reason: z.string().trim().max(255, 'too_big'),
  })
  .superRefine((value, ctx) => {
    if (value.movementType !== 'transfer') return;
    if (value.toShedId === '') {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'required', path: ['toShedId'] });
    } else if (value.toShedId === value.fromShedId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'invalid_format', path: ['toShedId'] });
    }
  });

export const eggCategoryInputSchema = z.object({
  name: z.string().trim().min(2, 'too_small').max(80, 'too_big'),
});

export const eggCollectionInputSchema = z
  .object({
    collectedOn: calendarDateSchema,
    batchId: z.union([z.string().uuid('invalid_format'), z.literal('')]),
    shedId: z.union([z.string().uuid('invalid_format'), z.literal('')]),
    shiftLabel: z.string().trim().max(40, 'too_big'),
    notes: z.string().trim().max(500, 'too_big'),
    lines: z
      .array(
        z.object({
          categoryId: z.string().uuid('invalid_format'),
          eggCount: z.number({ invalid_type_error: 'invalid_format' }).int('invalid_format').min(0, 'too_small').max(1_000_000, 'too_big'),
        }),
      )
      .min(1, 'too_small')
      .max(30, 'too_big'),
  })
  .superRefine((value, ctx) => {
    const seen = new Set<string>();
    for (const line of value.lines) {
      if (seen.has(line.categoryId)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'invalid_format', path: ['lines'] });
      }
      seen.add(line.categoryId);
    }
    if (!value.lines.some((line) => line.eggCount > 0)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'too_small', path: ['lines'] });
    }
  });

const optionalMeasure = z
  .object({
    value: z.union([z.number({ invalid_type_error: 'invalid_format' }).finite('invalid_format'), z.null()]),
    unit: z.string().trim().max(16, 'too_big'),
  })
  .superRefine((measure, ctx) => {
    if (measure.value !== null && measure.unit === '') {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'required', path: ['unit'] });
    }
    if (measure.value === null && measure.unit !== '') {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'required', path: ['value'] });
    }
  });

export const incubatorInputSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, 'too_small')
    .max(32, 'too_big')
    .regex(/^[A-Za-z0-9][A-Za-z0-9_-]*$/, 'invalid_format'),
  name: z.string().trim().min(2, 'too_small').max(120, 'too_big'),
  capacityEggs: z.union([
    z.number({ invalid_type_error: 'invalid_format' }).int('invalid_format').min(0, 'too_small').max(1_000_000, 'too_big'),
    z.null(),
  ]),
  notes: z.string().trim().max(500, 'too_big'),
});

export const incubatorReadingInputSchema = z.object({
  recordedOn: calendarDateSchema,
  recordedTime: z.union([z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'invalid_format'), z.literal('')]),
  temperature: optionalMeasure,
  humidity: optionalMeasure,
  powerStatus: z.enum(['on', 'off', 'unknown']),
  source: z.enum(['manual', 'sensor']),
  notes: z.string().trim().max(500, 'too_big'),
});

export const incubatorMaintenanceInputSchema = z.object({
  occurredOn: calendarDateSchema,
  status: z.enum(['in_service', 'out_of_service']),
  notes: z.string().trim().max(500, 'too_big'),
});

export const incubationInputSchema = z
  .object({
    code: z
      .string()
      .trim()
      .min(1, 'too_small')
      .max(32, 'too_big')
      .regex(/^[A-Za-z0-9][A-Za-z0-9_-]*$/, 'invalid_format'),
    mode: z.enum(['incubator', 'broody_hen']),
    incubatorId: z.union([z.string().uuid('invalid_format'), z.literal('')]),
    henName: z.string().trim().max(80, 'too_big'),
    startedOn: calendarDateSchema,
    eggCount: z.number({ invalid_type_error: 'invalid_format' }).int('invalid_format').min(1, 'too_small').max(1_000_000, 'too_big'),
    notes: z.string().trim().max(500, 'too_big'),
  })
  .superRefine((value, ctx) => {
    if (value.mode === 'incubator') {
      if (value.incubatorId === '') ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'required', path: ['incubatorId'] });
      if (value.henName !== '') ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'invalid_format', path: ['henName'] });
    } else {
      if (value.henName.length < 2) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'too_small', path: ['henName'] });
      if (value.incubatorId !== '') ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'invalid_format', path: ['incubatorId'] });
    }
  });

export const candlingInputSchema = z
  .object({
    observedOn: calendarDateSchema,
    inspectedCount: z.number({ invalid_type_error: 'invalid_format' }).int('invalid_format').min(1, 'too_small').max(1_000_000, 'too_big'),
    notes: z.string().trim().max(500, 'too_big'),
    lines: z
      .array(
        z.object({
          label: z.string().trim().min(1, 'too_small').max(80, 'too_big'),
          eggCount: z.number({ invalid_type_error: 'invalid_format' }).int('invalid_format').min(0, 'too_small').max(1_000_000, 'too_big'),
        }),
      )
      .min(1, 'too_small')
      .max(20, 'too_big'),
  })
  .superRefine((value, ctx) => {
    const seen = new Set<string>();
    for (const line of value.lines) {
      const key = line.label.toLocaleLowerCase();
      if (seen.has(key)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'invalid_format', path: ['lines'] });
      seen.add(key);
    }
    const total = value.lines.reduce((sum, line) => sum + line.eggCount, 0);
    if (total !== value.inspectedCount) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'invalid_format', path: ['inspectedCount'] });
    }
  });

export const hatchInputSchema = z
  .object({
    hatchedOn: calendarDateSchema,
    eggsSet: z.number({ invalid_type_error: 'invalid_format' }).int('invalid_format').min(0, 'too_small').max(1_000_000, 'too_big'),
    liveChicks: z.number({ invalid_type_error: 'invalid_format' }).int('invalid_format').min(0, 'too_small').max(1_000_000, 'too_big'),
    losses: z.number({ invalid_type_error: 'invalid_format' }).int('invalid_format').min(0, 'too_small').max(1_000_000, 'too_big'),
    otherCount: z.number({ invalid_type_error: 'invalid_format' }).int('invalid_format').min(0, 'too_small').max(1_000_000, 'too_big'),
    differenceNote: z.string().trim().max(500, 'too_big'),
    batchCode: z.string().trim().max(32, 'too_big'),
    birdTypeId: z.union([z.string().uuid('invalid_format'), z.literal('')]),
    shedId: z.union([z.string().uuid('invalid_format'), z.literal('')]),
  })
  .superRefine((value, ctx) => {
    const counted = value.liveChicks + value.losses + value.otherCount;
    if (counted !== value.eggsSet && value.differenceNote === '') {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'required', path: ['differenceNote'] });
    }
    if (value.liveChicks > 0) {
      if (!/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(value.batchCode)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'invalid_format', path: ['batchCode'] });
      }
      if (value.birdTypeId === '') ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'required', path: ['birdTypeId'] });
      if (value.shedId === '') ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'required', path: ['shedId'] });
    }
  });

export function proposedHatchRate(liveChicks: number, eggsSet: number) {
  return {
    status: 'proposed' as const,
    formula: 'live chicks ÷ eggs set × 100',
    liveChicks,
    eggsSet,
    percent: eggsSet === 0 ? null : Math.round((liveChicks * 1000) / eggsSet) / 10,
  };
}

export const taskTemplateInputSchema = z.object({
  name: z.string().trim().min(2, 'too_small').max(120, 'too_big'),
  season: z.union([z.enum(TASK_SEASONS), z.literal('')]),
});

export const taskTemplateRenameSchema = z.object({
  name: z.string().trim().min(2, 'too_small').max(120, 'too_big'),
});

export const taskStepInputSchema = z.object({
  body: z.string().trim().min(1, 'too_small').max(500, 'too_big'),
});

export const taskStepStatusSchema = z.object({
  status: z.enum(['active', 'skipped']),
});

export const taskInputSchema = z.object({
  title: z.string().trim().min(2, 'too_small').max(160, 'too_big'),
  dueOn: calendarDateSchema,
  instructions: z.string().trim().max(1000, 'too_big'),
  assigneeUserId: z.union([z.string().uuid('invalid_format'), z.literal('')]),
  proofRequired: z.boolean({ invalid_type_error: 'invalid_format' }),
  templateId: z.union([z.string().uuid('invalid_format'), z.literal('')]),
});

export const taskCompleteSchema = z.object({
  note: z.string().trim().max(500, 'too_big'),
});

const optionalQuantity = z.union([
  z.number({ invalid_type_error: 'invalid_format' }).positive('too_small').max(1_000_000, 'too_big'),
  z.null(),
]);

export const stockItemInputSchema = z.object({
  name: z.string().trim().min(1, 'too_small').max(120, 'too_big'),
  unitLabel: z.string().trim().min(1, 'too_small').max(32, 'too_big'),
  reorderLevel: z.union([
    z.number({ invalid_type_error: 'invalid_format' }).min(0, 'too_small').max(1_000_000, 'too_big'),
    z.null(),
  ]),
  notes: z.string().trim().max(500, 'too_big'),
});

export const stockMovementInputSchema = z
  .object({
    itemId: z.string().uuid('invalid_format'),
    movementType: z.enum(STOCK_MOVEMENT_TYPES),
    direction: z.enum(STOCK_DIRECTIONS),
    quantity: z.number({ invalid_type_error: 'invalid_format' }).positive('too_small').max(1_000_000, 'too_big'),
    occurredOn: calendarDateSchema,
    batchId: z.union([z.string().uuid('invalid_format'), z.literal('')]),
    shedId: z.union([z.string().uuid('invalid_format'), z.literal('')]),
    lotCode: z.string().trim().max(64, 'too_big'),
    expiresOn: z.union([calendarDateSchema, z.literal('')]),
    unitCost: z.union([
      z.number({ invalid_type_error: 'invalid_format' }).min(0, 'too_small').max(1_000_000_000, 'too_big'),
      z.null(),
    ]),
    supplierName: z.string().trim().max(160, 'too_big'),
    reason: z.string().trim().max(500, 'too_big'),
  })
  .superRefine((value, ctx) => {
    if (value.movementType === 'receipt' && value.direction !== 'in') {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'invalid_format', path: ['direction'] });
    }
    if ((value.movementType === 'use' || value.movementType === 'wastage') && value.direction !== 'out') {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'invalid_format', path: ['direction'] });
    }
    if (value.movementType === 'reversal' && value.reason === '') {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'required', path: ['reason'] });
    }
    if (value.unitCost !== null && value.movementType !== 'receipt') {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'invalid_format', path: ['unitCost'] });
    }
  });

export const waterInputSchema = z
  .object({
    recordedOn: calendarDateSchema,
    batchId: z.union([z.string().uuid('invalid_format'), z.literal('')]),
    shedId: z.union([z.string().uuid('invalid_format'), z.literal('')]),
    quantity: optionalQuantity,
    unitLabel: z.string().trim().max(32, 'too_big'),
    sourceNote: z.string().trim().max(160, 'too_big'),
    testNote: z.string().trim().max(500, 'too_big'),
    notes: z.string().trim().max(500, 'too_big'),
  })
  .superRefine((value, ctx) => {
    if (value.quantity !== null && value.unitLabel === '') {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'required', path: ['unitLabel'] });
    }
    if (value.quantity === null && value.unitLabel !== '') {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'required', path: ['quantity'] });
    }
  });

export const growthTargetInputSchema = z.object({
  birdTypeId: z.string().uuid('invalid_format'),
  ageDays: z.number({ invalid_type_error: 'invalid_format' }).int('invalid_format').min(1, 'too_small').max(10_000, 'too_big'),
  targetWeight: z.number({ invalid_type_error: 'invalid_format' }).positive('too_small').max(1_000_000, 'too_big'),
  weightUnit: z.enum(WEIGHT_UNITS),
});

export const weighingInputSchema = z.object({
  batchId: z.string().uuid('invalid_format'),
  weighedOn: calendarDateSchema,
  ageDays: z.union([
    z.number({ invalid_type_error: 'invalid_format' }).int('invalid_format').min(1, 'too_small').max(10_000, 'too_big'),
    z.null(),
  ]),
  weightValue: z.number({ invalid_type_error: 'invalid_format' }).positive('too_small').max(1_000_000, 'too_big'),
  weightUnit: z.enum(WEIGHT_UNITS),
  birdCount: z.union([
    z.number({ invalid_type_error: 'invalid_format' }).int('invalid_format').min(1, 'too_small').max(1_000_000, 'too_big'),
    z.null(),
  ]),
  notes: z.string().trim().max(500, 'too_big'),
});

export const knowledgeApprovalSchema = z
  .object({
    approved: z.boolean({ invalid_type_error: 'invalid_format' }),
    verificationNote: z.string().trim().max(1000, 'too_big'),
  })
  .superRefine((value, ctx) => {
    if (value.approved && value.verificationNote === '') {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'required', path: ['verificationNote'] });
    }
  });

export const healthObservationSchema = z.object({
  observedOn: calendarDateSchema,
  batchId: z.union([z.string().uuid('invalid_format'), z.literal('')]),
  birdCount: z.union([
    z.number({ invalid_type_error: 'invalid_format' }).int('invalid_format').min(0, 'too_small').max(1_000_000, 'too_big'),
    z.null(),
  ]),
  notes: z.string().trim().min(1, 'too_small').max(1000, 'too_big'),
  entryId: z.union([z.string().uuid('invalid_format'), z.literal('')]),
});

export const medicineRecordSchema = z.object({
  entryId: z.string().uuid('invalid_format'),
  givenOn: calendarDateSchema,
  batchId: z.union([z.string().uuid('invalid_format'), z.literal('')]),
  notes: z.string().trim().min(1, 'too_small').max(1000, 'too_big'),
});

export const vaccineTaskSchema = z.object({
  dueOn: calendarDateSchema,
  assigneeUserId: z.union([z.string().uuid('invalid_format'), z.literal('')]),
});

export const biosecurityStepSchema = z
  .object({
    origin: z.enum(['owner', 'pdf']),
    body: z.string().trim().max(1000, 'too_big'),
    sourceFile: z.string().trim().max(180, 'too_big'),
    sourcePage: z.union([
      z.number({ invalid_type_error: 'invalid_format' }).int('invalid_format').min(1, 'too_small').max(500, 'too_big'),
      z.null(),
    ]),
  })
  .superRefine((value, ctx) => {
    if (value.origin === 'owner' && value.body.length < 1) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'required', path: ['body'] });
    }
    if (value.origin === 'pdf' && (value.sourceFile === '' || value.sourcePage === null)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'required', path: ['sourcePage'] });
    }
  });

export const lossIncidentSchema = z.object({
  occurredOn: calendarDateSchema,
  birdCount: z.number({ invalid_type_error: 'invalid_format' }).int('invalid_format').min(0, 'too_small').max(1_000_000, 'too_big'),
  note: z.string().trim().min(1, 'too_small').max(1000, 'too_big'),
  movementId: z.union([z.string().uuid('invalid_format'), z.literal('')]),
});

export const customerInputSchema = z.object({
  name: z.string().trim().min(2, 'too_small').max(160, 'too_big'),
  phone: z.string().trim().max(32, 'too_big'),
  notes: z.string().trim().max(500, 'too_big'),
});

export const marketPriceInputSchema = z.object({
  itemName: z.string().trim().min(1, 'too_small').max(160, 'too_big'),
  amount: z.number({ invalid_type_error: 'invalid_format' }).min(0, 'too_small').max(1_000_000_000, 'too_big'),
  unitLabel: z.string().trim().min(1, 'too_small').max(32, 'too_big'),
  effectiveOn: calendarDateSchema,
});

export const orderInputSchema = z.object({
  customerId: z.string().uuid('invalid_format'),
  orderedOn: calendarDateSchema,
  lines: z
    .array(
      z.object({
        description: z.string().trim().min(1, 'too_small').max(160, 'too_big'),
        quantity: z.number({ invalid_type_error: 'invalid_format' }).positive('too_small').max(1_000_000, 'too_big'),
        unitPrice: z.number({ invalid_type_error: 'invalid_format' }).min(0, 'too_small').max(1_000_000_000, 'too_big'),
      }),
    )
    .min(1, 'too_small')
    .max(20, 'too_big'),
});

export const closeBatchSchema = z.object({
  version: z.number({ invalid_type_error: 'invalid_format' }).int('invalid_format').positive('too_small'),
});

export const pageSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).max(1000).default(0),
});

export type BirdTypeInput = z.infer<typeof birdTypeInputSchema>;
export type BatchInput = z.infer<typeof batchInputSchema>;
export type MovementInput = z.infer<typeof movementInputSchema>;
export type CloseBatchInput = z.infer<typeof closeBatchSchema>;
export type EggCategoryInput = z.infer<typeof eggCategoryInputSchema>;
export type EggCollectionInput = z.infer<typeof eggCollectionInputSchema>;
export type IncubatorInput = z.infer<typeof incubatorInputSchema>;
export type IncubatorReadingInput = z.infer<typeof incubatorReadingInputSchema>;
export type IncubatorMaintenanceInput = z.infer<typeof incubatorMaintenanceInputSchema>;
export type IncubationInput = z.infer<typeof incubationInputSchema>;
export type HatchInput = z.infer<typeof hatchInputSchema>;
export type CandlingInput = z.infer<typeof candlingInputSchema>;
export type TaskTemplateInput = z.infer<typeof taskTemplateInputSchema>;
export type TaskTemplateRenameInput = z.infer<typeof taskTemplateRenameSchema>;
export type TaskStepInput = z.infer<typeof taskStepInputSchema>;
export type TaskInput = z.infer<typeof taskInputSchema>;
export type TaskCompleteInput = z.infer<typeof taskCompleteSchema>;
export type StockItemInput = z.infer<typeof stockItemInputSchema>;
export type StockMovementInput = z.infer<typeof stockMovementInputSchema>;
export type WaterInput = z.infer<typeof waterInputSchema>;
export type GrowthTargetInput = z.infer<typeof growthTargetInputSchema>;
export type WeighingInput = z.infer<typeof weighingInputSchema>;
export type KnowledgeApprovalInput = z.infer<typeof knowledgeApprovalSchema>;
export type HealthObservationInput = z.infer<typeof healthObservationSchema>;
export type MedicineRecordInput = z.infer<typeof medicineRecordSchema>;
export type VaccineTaskInput = z.infer<typeof vaccineTaskSchema>;
export type BiosecurityStepInput = z.infer<typeof biosecurityStepSchema>;
export type LossIncidentInput = z.infer<typeof lossIncidentSchema>;
export type CustomerInput = z.infer<typeof customerInputSchema>;
export type MarketPriceInput = z.infer<typeof marketPriceInputSchema>;
export type OrderInput = z.infer<typeof orderInputSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type FarmInput = z.infer<typeof farmInputSchema>;
export type FarmUpdateInput = z.infer<typeof farmUpdateSchema>;
export type ShedInput = z.infer<typeof shedInputSchema>;
export type ShedUpdateInput = z.infer<typeof shedUpdateSchema>;
export type InviteInput = z.infer<typeof inviteSchema>;
export type MembershipUpdateInput = z.infer<typeof membershipUpdateSchema>;
