import { planPhoneAlerts } from '@gavran/shared';
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
  });
});
