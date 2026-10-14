import { z } from 'zod';

export type DoseSlot = 'morning' | 'evening' | 'full_day';

function daysBetween(from: string, to: string): number {
  const [y1, m1, d1] = from.split('-').map(Number);
  const [y2, m2, d2] = to.split('-').map(Number);
  const start = Date.UTC(y1 ?? 1970, (m1 ?? 1) - 1, d1 ?? 1);
  const end = Date.UTC(y2 ?? 1970, (m2 ?? 1) - 1, d2 ?? 1);
  return Math.round((end - start) / 86_400_000);
}

function paperDay(hatchDate: string | null, onDate: string): number | null {
  if (!hatchDate || hatchDate > onDate) return null;
  return daysBetween(hatchDate, onDate) + 1;
}

function shiftDate(iso: string, days: number): string {
  const [year, month, day] = iso.split('-').map(Number);
  const date = new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Shown on owner-written medicines. These are not lines from the training PDFs. */
export const OWNER_CITE = 'Added by owner';

export const MEDICINE_ROUTES = ['water', 'feed', 'eye_drop', 'injection'] as const;
export const MEDICINE_SOURCES = ['experience', 'vet', 'paper'] as const;

export type MedicineRoute = (typeof MEDICINE_ROUTES)[number];
export type MedicineSource = (typeof MEDICINE_SOURCES)[number];

const day = z.number().int().min(1).max(2000).nullable();

export const ownerDiseaseInputSchema = z.object({
  name: z.string().trim().min(1).max(180),
  symptoms: z.string().trim().min(1).max(1000),
});

export const ownerMedicineInputSchema = z
  .object({
    name: z.string().trim().min(1).max(160),
    doseAmount: z.string().trim().min(1).max(40),
    doseUnit: z.string().trim().min(1).max(40),
    forBirds: z.number().int().min(1).max(100_000).nullable(),
    route: z.enum(MEDICINE_ROUTES),
    slot: z.enum(['morning', 'evening', 'full_day']),
    ageDayFrom: day,
    ageDayTo: day,
    durationDays: z.number().int().min(1).max(60),
    notes: z.string().trim().max(1000),
    precaution: z.string().trim().max(500),
    sourceKind: z.enum(MEDICINE_SOURCES),
    sourceDetail: z.string().trim().max(160),
    knowledgeEntryIds: z.array(z.string().uuid()).max(12),
    ownerDiseaseIds: z.array(z.string().uuid()).max(12),
  })
  .superRefine((value, ctx) => {
    if ((value.sourceKind === 'vet' || value.sourceKind === 'paper') && value.sourceDetail.length < 1) {
      ctx.addIssue({ code: 'custom', message: 'too_small', path: ['sourceDetail'] });
    }
    if (value.ageDayFrom !== null && value.ageDayTo !== null && value.ageDayFrom > value.ageDayTo) {
      ctx.addIssue({ code: 'custom', message: 'invalid_format', path: ['ageDayTo'] });
    }
    if (value.knowledgeEntryIds.length + value.ownerDiseaseIds.length < 1) {
      ctx.addIssue({ code: 'custom', message: 'required', path: ['knowledgeEntryIds'] });
    }
  });

export const ownerPlanInputSchema = z
  .object({
    batchId: z.string().uuid(),
    anchor: z.enum(['date', 'age']),
    startOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
    startAgeDay: z.number().int().min(1).max(2000).nullable(),
    repeatDays: z.number().int().min(1).max(30),
  })
  .superRefine((value, ctx) => {
    if (value.anchor === 'date' && !value.startOn) ctx.addIssue({ code: 'custom', message: 'required', path: ['startOn'] });
    if (value.anchor === 'age' && value.startAgeDay === null) ctx.addIssue({ code: 'custom', message: 'required', path: ['startAgeDay'] });
    if (value.anchor === 'date' && value.startAgeDay !== null) ctx.addIssue({ code: 'custom', message: 'invalid_format', path: ['startAgeDay'] });
    if (value.anchor === 'age' && value.startOn) ctx.addIssue({ code: 'custom', message: 'invalid_format', path: ['startOn'] });
  });

export type OwnerMedicineInput = z.infer<typeof ownerMedicineInputSchema>;

const routeWords: Record<MedicineRoute, string> = {
  water: 'in the water',
  feed: 'in the feed',
  eye_drop: 'as an eye drop',
  injection: 'as an injection',
};

/** The sentence is only the amount, unit, route, and bird count the owner typed. */
export function ownerDoseSentence(input: {
  doseAmount: string;
  doseUnit: string;
  route: MedicineRoute;
  forBirds: number | null;
  notes: string;
  precaution: string;
}): string {
  const birds = input.forBirds === null ? '' : ` for ${input.forBirds} birds`;
  const parts = [`${input.doseAmount.trim()} ${input.doseUnit.trim()} ${routeWords[input.route]}${birds}.`];
  if (input.notes.trim()) parts.push(input.notes.trim());
  if (input.precaution.trim()) parts.push(input.precaution.trim());
  return parts.join(' ');
}

export function ownerScheduleText(input: {
  slot: DoseSlot;
  durationDays: number;
  ageDayFrom: number | null;
  ageDayTo: number | null;
}): string {
  const age =
    input.ageDayFrom !== null && input.ageDayTo !== null
      ? `Age day ${input.ageDayFrom} to ${input.ageDayTo}. `
      : input.ageDayFrom !== null
        ? `From age day ${input.ageDayFrom}. `
        : '';
  return `${age}${input.slot}, for ${input.durationDays} days. ${OWNER_CITE}.`;
}

export function ownerPhotoKey(id: string): string {
  return `own${id.replace(/-/g, '')}`;
}

export type CoursePoint = { date: string; paperDay: number | null };

/** Days the owner asked to give this medicine. Repeat 1 is every day. Repeat 2 skips a day. */
export function ownerCourse(input: {
  anchor: 'date' | 'age';
  startOn: string | null;
  startAgeDay: number | null;
  durationDays: number;
  repeatDays: number;
  hatchDate: string | null;
}): CoursePoint[] {
  const repeat = Math.max(1, input.repeatDays);
  const points: CoursePoint[] = [];
  if (input.anchor === 'date') {
    if (!input.startOn) return [];
    for (let offset = 0; offset < input.durationDays; offset += repeat) {
      const date = shiftDate(input.startOn, offset);
      points.push({ date, paperDay: paperDay(input.hatchDate, date) });
    }
    return points;
  }
  if (input.startAgeDay === null || !input.hatchDate) return [];
  for (let offset = 0; offset < input.durationDays; offset += repeat) {
    const age = input.startAgeDay + offset;
    const date = shiftDate(input.hatchDate, age - 1);
    points.push({ date, paperDay: age });
  }
  return points;
}
