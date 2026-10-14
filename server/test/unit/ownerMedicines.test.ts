import { describe, expect, it } from 'vitest';
import { OWNER_CITE, SAATHI_VET_LABEL, matchKnowledge, ownerCourse, ownerDoseSentence } from '@gavran/shared';

describe('owner medicines', () => {
  it('places a date course on every other day', () => {
    const points = ownerCourse({
      anchor: 'date',
      startOn: '2026-10-14',
      startAgeDay: null,
      durationDays: 5,
      repeatDays: 2,
      hatchDate: null,
    });
    expect(points.map((point) => point.date)).toEqual(['2026-10-14', '2026-10-16', '2026-10-18']);
    expect(points.every((point) => point.paperDay === null)).toBe(true);
  });

  it('places an age course from the hatch date', () => {
    const points = ownerCourse({
      anchor: 'age',
      startOn: null,
      startAgeDay: 3,
      durationDays: 3,
      repeatDays: 1,
      hatchDate: '2026-10-12',
    });
    expect(points.map((point) => point.paperDay)).toEqual([3, 4, 5]);
    expect(points.map((point) => point.date)).toEqual(['2026-10-14', '2026-10-15', '2026-10-16']);
  });

  it('returns nothing for an age course without a hatch date', () => {
    expect(
      ownerCourse({
        anchor: 'age',
        startOn: null,
        startAgeDay: 3,
        durationDays: 3,
        repeatDays: 1,
        hatchDate: null,
      }),
    ).toEqual([]);
  });

  it('writes only the amount the owner typed', () => {
    const sentence = ownerDoseSentence({
      doseAmount: '5',
      doseUnit: 'ml',
      route: 'water',
      forBirds: 20,
      notes: 'last summer',
      precaution: 'keep the water in the shade',
    });
    expect(sentence).toBe('5 ml in the water for 20 birds. last summer keep the water in the shade');
    expect(sentence.match(/\d+/g)).toEqual(['5', '20']);
    expect(sentence).not.toMatch(/mg|tablet|drop/i);
  });

  it('matches an owner entry and cites the owner', () => {
    const matches = matchKnowledge('watery eyes and a sneeze', [
      {
        id: '1',
        title: 'Tulsi water',
        sourceFile: OWNER_CITE,
        sourcePage: 0,
        symptoms: 'watery eyes and a sneeze',
        usedFor: 'Watery eyes',
        howToGive: '5 ml in the water for 20 birds.',
        scheduleText: 'morning, for 3 days. Added by owner.',
      },
    ]);
    expect(matches[0]?.sourceFile).toBe('Added by owner');
    expect(matches[0]?.sourcePage).toBe(0);
    expect(matches[0]?.howToGive).toContain('5 ml');
    expect(matches[0]?.label).toBe(SAATHI_VET_LABEL);
    expect(matches[0]).not.toHaveProperty('dose');
  });
});
