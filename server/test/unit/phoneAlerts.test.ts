import { dailyPhoneNotices, planPhoneAlerts } from '@gavran/shared';
import { describe, expect, it } from 'vitest';

describe('phone alerts', () => {
  it('plans morning medicine and low feed at 8:00, and evening medicine and eggs at 17:00', () => {
    const now = new Date(2026, 9, 14, 7, 0, 0);
    const plans = planPhoneAlerts({ now, morningDue: 2, eveningDue: 1, lowStock: 3, eggsMissing: true });
    expect(plans.map((plan) => [plan.id, plan.kind, plan.count])).toEqual([
      [800, 'morning', 2],
      [801, 'low_stock', 3],
      [1700, 'evening', 1],
      [1701, 'eggs', 1],
    ]);
    expect(new Date(plans[0]!.at).getHours()).toBe(8);
    expect(new Date(plans[2]!.at).getHours()).toBe(17);
  });

  it('fires a passed clock one minute later and skips empty counts', () => {
    const now = new Date(2026, 9, 14, 9, 15, 0);
    const plans = planPhoneAlerts({ now, morningDue: 1, eveningDue: 0, lowStock: 0, eggsMissing: false });
    expect(plans).toHaveLength(1);
    expect(plans[0]!.id).toBe(800);
    expect(new Date(plans[0]!.at).getTime()).toBe(now.getTime() + 60_000);
    expect(plans[0]!.hour).toBe(8);
    expect(plans[0]!.minute).toBe(0);
  });

  it('keeps daily alarms at 8:00 and 17:00 even when nothing is due', () => {
    const notices = dailyPhoneNotices({ morningDue: 0, eveningDue: 0, lowStock: 0, eggsMissing: false });
    expect(notices.map((row) => [row.id, row.kind, row.hour, row.minute])).toEqual([
      [800, 'morning', 8, 0],
      [801, 'low_stock', 8, 0],
      [1700, 'evening', 17, 0],
      [1701, 'eggs', 17, 0],
    ]);
  });
});
