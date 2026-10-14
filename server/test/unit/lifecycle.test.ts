import { batchStage } from '@gavran/shared';
import { describe, expect, it } from 'vitest';

describe('batch stage', () => {
  it('stays in the incubator until hatch, then broods for 28 days', () => {
    expect(batchStage({ today: '2026-10-10', eggSetOn: '2026-10-01', hatchDate: '2026-10-22' }).stage).toBe('incubator');
    const brooding = batchStage({ today: '2026-10-25', eggSetOn: '2026-10-01', hatchDate: '2026-10-22' });
    expect(brooding.stage).toBe('brooding');
    expect(brooding.broodingDaysLeft).toBe(25);
    const ending = batchStage({ today: '2026-11-16', eggSetOn: '2026-10-01', hatchDate: '2026-10-22' });
    expect(ending.stage).toBe('brooding');
    expect(ending.broodingDaysLeft).toBe(3);
    expect(batchStage({ today: '2026-11-20', eggSetOn: '2026-10-01', hatchDate: '2026-10-22' }).stage).toBe('grow_out');
  });
});
