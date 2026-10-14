import { describe, expect, it } from 'vitest';
import { DOSE_SOURCE, PAPER_ROWS, paperDay } from '../../src/modules/doses/catalog.js';

describe('chick-day paper', () => {
  it('copies each line from the step-by-step PDF and leaves only Coryza unclear', () => {
    expect(PAPER_ROWS.length).toBe(20);
    expect(PAPER_ROWS.every((row) => row.sourcePage >= 1 && row.amountText.trim().length > 0)).toBe(true);
    const unclear = PAPER_ROWS.filter((row) => row.unclear);
    expect(unclear.map((row) => row.itemName)).toEqual(['Coryza vaccine']);
    expect(unclear[0]?.dayFrom).toBeNull();
    expect(unclear[0]?.dayTo).toBeNull();
    expect(unclear[0]?.amountText.toLowerCase()).toContain('check with the vet');
    expect(unclear[0]?.sourcePage).toBe(27);
    const days = new Set<number>();
    for (const row of PAPER_ROWS) {
      if (row.dayFrom === null) continue;
      for (let day = row.dayFrom; day <= (row.dayTo ?? row.dayFrom); day += 1) days.add(day);
    }
    const numbered = [...days].sort((a, b) => a - b);
    expect(numbered.slice(0, 21)).toEqual(Array.from({ length: 21 }, (_, index) => index + 1));
    expect(numbered).toContain(28);
    expect(numbered).toContain(42);
    expect(numbered).toContain(56);
    expect(numbered).not.toContain(22);
    const evening = PAPER_ROWS.find((row) => row.sourcePage === 18 && row.slot === 'evening');
    expect(evening?.amountText).toContain('1 ml');
    const whole = PAPER_ROWS.find((row) => row.sourcePage === 24);
    expect(whole?.amountText).toContain('2 ml');
    expect(DOSE_SOURCE).toBe('patil-poultry-step-by-step-process.pdf');
    expect(PAPER_ROWS.every((row) => row.medicineKeys.length > 0)).toBe(true);
  });

  it('treats the hatch date as day 1', () => {
    expect(paperDay('2026-03-01', '2026-03-01')).toBe(1);
    expect(paperDay('2026-03-01', '2026-03-03')).toBe(3);
    expect(paperDay('2026-03-04', '2026-03-03')).toBeNull();
    expect(paperDay(null, '2026-03-03')).toBeNull();
  });
});
