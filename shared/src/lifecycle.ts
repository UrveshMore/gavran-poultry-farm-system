/** The owner asked for brooding through day 28. This is not an official hatch formula. */
export const BROODING_DAYS = 28;

export type BatchStageName = 'incubator' | 'brooding' | 'grow_out' | 'not_set';

function daysBetween(start: string, end: string): number {
  const ms = Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`);
  return Math.round(ms / 86_400_000);
}

export function batchStage(input: { today: string; eggSetOn: string | null; hatchDate: string | null }): {
  stage: BatchStageName;
  daysInStage: number | null;
  broodingDaysLeft: number | null;
} {
  const { today, eggSetOn, hatchDate } = input;
  if (eggSetOn && (!hatchDate || today < hatchDate)) {
    return { stage: 'incubator', daysInStage: Math.max(0, daysBetween(eggSetOn, today)), broodingDaysLeft: null };
  }
  if (hatchDate && today >= hatchDate) {
    const age = daysBetween(hatchDate, today);
    if (age <= BROODING_DAYS) {
      return { stage: 'brooding', daysInStage: age, broodingDaysLeft: BROODING_DAYS - age };
    }
    return { stage: 'grow_out', daysInStage: age - BROODING_DAYS, broodingDaysLeft: null };
  }
  return { stage: 'not_set', daysInStage: null, broodingDaysLeft: null };
}
