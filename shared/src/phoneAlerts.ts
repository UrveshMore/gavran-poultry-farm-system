export type PhoneAlertKind = 'morning' | 'evening' | 'low_stock' | 'eggs';

export type PhoneAlertPlan = {
  id: number;
  kind: PhoneAlertKind;
  at: string;
  count: number;
  hour: number;
  minute: number;
};

export type DailyPhoneNotice = {
  id: number;
  kind: PhoneAlertKind;
  hour: number;
  minute: number;
  count: number;
};

function clock(minuteOfDay: number): { hour: number; minute: number } {
  const minute = Math.min(1439, Math.max(0, Math.trunc(minuteOfDay)));
  return { hour: Math.floor(minute / 60), minute: minute % 60 };
}

function atClock(now: Date, hour: number, minute: number): Date {
  const at = new Date(now);
  at.setHours(hour, minute, 0, 0);
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
  morningOn?: boolean;
  eveningOn?: boolean;
  lowStockOn?: boolean;
  eggsOn?: boolean;
  morningMinute?: number;
  eveningMinute?: number;
}): PhoneAlertPlan[] {
  const morning = clock(input.morningMinute ?? 480);
  const evening = clock(input.eveningMinute ?? 1020);
  const plans: PhoneAlertPlan[] = [];
  if (input.morningOn !== false && input.morningDue > 0) {
    plans.push({ id: 800, kind: 'morning', at: atClock(input.now, morning.hour, morning.minute).toISOString(), count: input.morningDue, hour: morning.hour, minute: morning.minute });
  }
  if (input.lowStockOn !== false && input.lowStock > 0) {
    plans.push({ id: 801, kind: 'low_stock', at: atClock(input.now, morning.hour, morning.minute).toISOString(), count: input.lowStock, hour: morning.hour, minute: morning.minute });
  }
  if (input.eveningOn !== false && input.eveningDue > 0) {
    plans.push({ id: 1700, kind: 'evening', at: atClock(input.now, evening.hour, evening.minute).toISOString(), count: input.eveningDue, hour: evening.hour, minute: evening.minute });
  }
  if (input.eggsOn !== false && input.eggsMissing) {
    plans.push({ id: 1701, kind: 'eggs', at: atClock(input.now, evening.hour, evening.minute).toISOString(), count: 1, hour: evening.hour, minute: evening.minute });
  }
  return plans;
}

/** Repeating alarms the phone keeps after the app closes. Enabled kinds stay on the clock even when today's count is zero. */
export function dailyPhoneNotices(input: {
  morningDue: number;
  eveningDue: number;
  lowStock: number;
  eggsMissing: boolean;
  morningOn?: boolean;
  eveningOn?: boolean;
  lowStockOn?: boolean;
  eggsOn?: boolean;
  morningMinute?: number;
  eveningMinute?: number;
}): DailyPhoneNotice[] {
  const morning = clock(input.morningMinute ?? 480);
  const evening = clock(input.eveningMinute ?? 1020);
  const notices: DailyPhoneNotice[] = [];
  if (input.morningOn !== false) notices.push({ id: 800, kind: 'morning', hour: morning.hour, minute: morning.minute, count: input.morningDue });
  if (input.lowStockOn !== false) notices.push({ id: 801, kind: 'low_stock', hour: morning.hour, minute: morning.minute, count: input.lowStock });
  if (input.eveningOn !== false) notices.push({ id: 1700, kind: 'evening', hour: evening.hour, minute: evening.minute, count: input.eveningDue });
  if (input.eggsOn !== false) notices.push({ id: 1701, kind: 'eggs', hour: evening.hour, minute: evening.minute, count: input.eggsMissing ? 1 : 0 });
  return notices;
}
