export type PhoneAlertKind = 'morning' | 'evening' | 'low_stock' | 'eggs';

export type PhoneAlertPlan = {
  id: number;
  kind: PhoneAlertKind;
  at: string;
  count: number;
};

function atClock(now: Date, hour: number): Date {
  const at = new Date(now);
  at.setHours(hour, 0, 0, 0);
  if (at.getTime() <= now.getTime()) at.setTime(now.getTime() + 60_000);
  return at;
}

/** Morning doses and low feed at 8:00. Evening doses and missing eggs at 17:00. Times already passed fire one minute later. */
export function planPhoneAlerts(input: {
  now: Date;
  morningDue: number;
  eveningDue: number;
  lowStock: number;
  eggsMissing: boolean;
}): PhoneAlertPlan[] {
  const plans: PhoneAlertPlan[] = [];
  if (input.morningDue > 0) {
    plans.push({ id: 800, kind: 'morning', at: atClock(input.now, 8).toISOString(), count: input.morningDue });
  }
  if (input.lowStock > 0) {
    plans.push({ id: 801, kind: 'low_stock', at: atClock(input.now, 8).toISOString(), count: input.lowStock });
  }
  if (input.eveningDue > 0) {
    plans.push({ id: 1700, kind: 'evening', at: atClock(input.now, 17).toISOString(), count: input.eveningDue });
  }
  if (input.eggsMissing) {
    plans.push({ id: 1701, kind: 'eggs', at: atClock(input.now, 17).toISOString(), count: 1 });
  }
  return plans;
}
