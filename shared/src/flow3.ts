import { z } from 'zod';
import { calendarDateSchema } from './schemas.js';

const name = z.string().trim().min(1, 'too_small').max(120, 'too_big');
const count = z.number({ invalid_type_error: 'invalid_format' }).int('invalid_format').positive('too_small').max(1_000_000, 'too_big');
const notes = z.string().trim().max(500, 'too_big').default('');
const unit = z.string().trim().min(1, 'too_small').max(32, 'too_big');

export const HATCH_LENGTH_DAYS = 21;
export const MOVE_REMINDER_DAYS = 30;

export const flowIncubatorInputSchema = z.object({
  name,
  capacity: count,
});

export const flowShedInputSchema = flowIncubatorInputSchema;

export const flowBatchInputSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('set'),
    incubatorId: z.string().uuid('invalid_format'),
    eggsSet: count,
    setOn: calendarDateSchema,
    notes,
  }),
  z.object({
    kind: z.literal('existing'),
    birdCount: count,
    shedId: z.string().uuid('invalid_format'),
    placedOn: calendarDateSchema,
    notes,
  }),
]);

export const flowHatchDayInputSchema = z.object({
  dayNumber: z.number({ invalid_type_error: 'invalid_format' }).int('invalid_format').positive('too_small').max(80, 'too_big'),
  liveCount: z.number({ invalid_type_error: 'invalid_format' }).int('invalid_format').min(0, 'too_small').max(1_000_000, 'too_big'),
});

export const flowMoveInputSchema = z.object({
  batchId: z.string().uuid('invalid_format'),
  kind: z.enum(['opening', 'brooding_death', 'to_shed', 'between_sheds', 'exit']),
  birdCount: count,
  occurredOn: calendarDateSchema,
  shedId: z.string().uuid('invalid_format').optional(),
  fromShedId: z.string().uuid('invalid_format').optional(),
  reason: z.enum(['died', 'sold', 'other']).optional(),
  buyer: z.string().trim().max(120, 'too_big').default(''),
  quantity: z.number({ invalid_type_error: 'invalid_format' }).positive('too_small').max(1_000_000, 'too_big').optional(),
  price: z.number({ invalid_type_error: 'invalid_format' }).min(0, 'too_small').max(1_000_000_000, 'too_big').optional(),
  unitLabel: unit.default('Rs'),
  notes,
});

export const flowDoseInputSchema = z.object({
  batchId: z.string().uuid('invalid_format'),
  scheduleRowId: z.string().uuid('invalid_format'),
  givenOn: calendarDateSchema,
  notes,
});

export const flowFeedInputSchema = z.object({
  batchId: z.string().uuid('invalid_format'),
  occurredOn: calendarDateSchema,
  feedType: name,
  quantity: z.number({ invalid_type_error: 'invalid_format' }).positive('too_small').max(1_000_000, 'too_big'),
  unitLabel: unit,
  notes,
});

export const flowEggInputSchema = z.object({
  occurredOn: calendarDateSchema,
  collected: z.number({ invalid_type_error: 'invalid_format' }).int('invalid_format').min(0, 'too_small').max(1_000_000, 'too_big'),
  sold: z.number({ invalid_type_error: 'invalid_format' }).int('invalid_format').min(0, 'too_small').max(1_000_000, 'too_big'),
  forIncubator: z.number({ invalid_type_error: 'invalid_format' }).int('invalid_format').min(0, 'too_small').max(1_000_000, 'too_big'),
  notes,
});

export const flowExpenseInputSchema = z.object({
  occurredOn: calendarDateSchema,
  category: z.enum(['feed', 'medicine', 'electricity', 'other']),
  amount: z.number({ invalid_type_error: 'invalid_format' }).min(0, 'too_small').max(1_000_000_000, 'too_big'),
  unitLabel: unit.default('Rs'),
  notes,
});

export const flowSaleInputSchema = z.object({
  occurredOn: calendarDateSchema,
  kind: z.enum(['eggs', 'birds']),
  quantity: z.number({ invalid_type_error: 'invalid_format' }).positive('too_small').max(1_000_000, 'too_big'),
  price: z.number({ invalid_type_error: 'invalid_format' }).min(0, 'too_small').max(1_000_000_000, 'too_big'),
  buyer: name,
  unitLabel: unit.default('Rs'),
  batchId: z.string().uuid('invalid_format').optional(),
  notes,
});

export function plusDays(iso: string, days: number): string {
  const [year, month, day] = iso.split('-').map(Number);
  const date = new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, (day ?? 1) + days));
  return date.toISOString().slice(0, 10);
}

export function ageFromHatch(hatchOn: string, day: string): number {
  const start = Date.parse(`${hatchOn}T00:00:00Z`);
  const end = Date.parse(`${day}T00:00:00Z`);
  return Math.round((end - start) / 86_400_000) + 1;
}

export function typedAmount(quantity: number, price: number): number {
  return Math.round(quantity * price * 100) / 100;
}
