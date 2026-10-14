/** Day-by-day lines copied from the owner's step-by-step PDF. No amount was added. */

export const DOSE_SOURCE = 'patil-poultry-step-by-step-process.pdf';
export const DOSE_TEMPLATE_ID = '00000000-0000-4000-8000-000000000270';
export const DOSE_TEMPLATE_CODE = 'patil-chick-days';

export type DoseSlot = 'morning' | 'evening' | 'full_day';

export type PaperRow = {
  id: string;
  dayFrom: number | null;
  dayTo: number | null;
  dayLabel: string;
  slot: DoseSlot;
  itemName: string;
  amountText: string;
  unclear: boolean;
  sourcePage: number;
  amountPage: number | null;
  medicineKeys: string[];
  sort: number;
};

const id = (n: number) => `00000000-0000-4000-8000-000000000${n}`;

export const PAPER_ROWS: PaperRow[] = [
  {
    id: id(271),
    dayFrom: 1,
    dayTo: 3,
    dayLabel: 'Day 1, 2, 3',
    slot: 'morning',
    itemName: 'Electrolyte powder and vinegar',
    amountText: 'For 100 birds: 1 litre water, 1 g electrolyte powder, and 1 ml vinegar.',
    unclear: false,
    sourcePage: 17,
    amountPage: null,
    medicineKeys: ['electrolyte', 'vinegar'],
    sort: 10,
  },
  {
    id: id(272),
    dayFrom: 1,
    dayTo: 3,
    dayLabel: 'Day 1, 2, 3',
    slot: 'evening',
    itemName: 'Limcee and B-complex',
    amountText: '4 litres water, 1 Limcee tablet (vitamin C), and 1 B-complex tablet.',
    unclear: false,
    sourcePage: 17,
    amountPage: null,
    medicineKeys: ['limcee', 'bcomplex'],
    sort: 20,
  },
  {
    id: id(273),
    dayFrom: 4,
    dayTo: 5,
    dayLabel: 'Day 4, 5',
    slot: 'morning',
    itemName: 'Vimeral or Multistar',
    amountText: '1 litre water, 1 ml Vimeral or Multistar.',
    unclear: false,
    sourcePage: 18,
    amountPage: null,
    medicineKeys: ['vimeral'],
    sort: 30,
  },
  {
    id: id(274),
    dayFrom: 4,
    dayTo: 5,
    dayLabel: 'Day 4, 5',
    slot: 'evening',
    itemName: 'Enrocin',
    amountText: '1 litre water, 1 ml Enrocin.',
    unclear: false,
    sourcePage: 18,
    amountPage: null,
    medicineKeys: ['enrocin'],
    sort: 40,
  },
  {
    id: id(275),
    dayFrom: 6,
    dayTo: 6,
    dayLabel: 'Day 6',
    slot: 'full_day',
    itemName: 'Lasota vaccine',
    amountText: 'One drop in the eye or the nose. This day page names the vaccine. The drop is written on the vaccine list.',
    unclear: false,
    sourcePage: 19,
    amountPage: 27,
    medicineKeys: ['lasota'],
    sort: 50,
  },
  {
    id: id(276),
    dayFrom: 7,
    dayTo: 9,
    dayLabel: 'Day 7, 8, 9',
    slot: 'morning',
    itemName: 'Limcee',
    amountText: '1 litre water, half a Limcee tablet.',
    unclear: false,
    sourcePage: 20,
    amountPage: null,
    medicineKeys: ['limcee'],
    sort: 60,
  },
  {
    id: id(277),
    dayFrom: 7,
    dayTo: 9,
    dayLabel: 'Day 7, 8, 9',
    slot: 'evening',
    itemName: 'Brotone liver tonic',
    amountText: '1 litre water, 1 ml Brotone liver tonic.',
    unclear: false,
    sourcePage: 20,
    amountPage: null,
    medicineKeys: ['brotone'],
    sort: 70,
  },
  {
    id: id(278),
    dayFrom: 10,
    dayTo: 11,
    dayLabel: 'Day 10, 11',
    slot: 'full_day',
    itemName: 'Vimeral',
    amountText: '1 litre water, 1 ml Vimeral. The page says the whole day.',
    unclear: false,
    sourcePage: 21,
    amountPage: null,
    medicineKeys: ['vimeral'],
    sort: 80,
  },
  {
    id: id(279),
    dayFrom: 12,
    dayTo: 13,
    dayLabel: 'Day 12, 13',
    slot: 'morning',
    itemName: 'Toxol',
    amountText: '1 litre water, 1 ml Toxol.',
    unclear: false,
    sourcePage: 22,
    amountPage: null,
    medicineKeys: ['toxol'],
    sort: 90,
  },
  {
    id: id(280),
    dayFrom: 12,
    dayTo: 13,
    dayLabel: 'Day 12, 13',
    slot: 'evening',
    itemName: 'E-Care Se',
    amountText: '1 litre water, 2 g E-Care Se.',
    unclear: false,
    sourcePage: 22,
    amountPage: null,
    medicineKeys: ['ecare'],
    sort: 100,
  },
  {
    id: id(281),
    dayFrom: 14,
    dayTo: 14,
    dayLabel: 'Day 14',
    slot: 'full_day',
    itemName: 'Gumboro vaccine',
    amountText: 'One drop in the eye or the nose. This day page names the vaccine. The drop is written on the vaccine list.',
    unclear: false,
    sourcePage: 23,
    amountPage: 27,
    medicineKeys: ['gumboro'],
    sort: 110,
  },
  {
    id: id(282),
    dayFrom: 15,
    dayTo: 17,
    dayLabel: 'Day 15, 16, 17',
    slot: 'full_day',
    itemName: 'Enrocin-BH',
    amountText: '1 litre water, 2 ml Enrocin-BH. The page says the whole day.',
    unclear: false,
    sourcePage: 24,
    amountPage: null,
    medicineKeys: ['enrocin'],
    sort: 120,
  },
  {
    id: id(283),
    dayFrom: 18,
    dayTo: 20,
    dayLabel: 'Day 18, 19, 20',
    slot: 'morning',
    itemName: 'Toxol',
    amountText: '1 litre water, 2 ml Toxol.',
    unclear: false,
    sourcePage: 25,
    amountPage: null,
    medicineKeys: ['toxol'],
    sort: 130,
  },
  {
    id: id(284),
    dayFrom: 18,
    dayTo: 20,
    dayLabel: 'Day 18, 19, 20',
    slot: 'evening',
    itemName: 'Brotone liver tonic',
    amountText: '1 litre water, 2 ml Brotone liver tonic.',
    unclear: false,
    sourcePage: 25,
    amountPage: null,
    medicineKeys: ['brotone'],
    sort: 140,
  },
  {
    id: id(285),
    dayFrom: 21,
    dayTo: 21,
    dayLabel: 'Day 21',
    slot: 'full_day',
    itemName: 'Lasota booster',
    amountText: 'One drop in the eye or the nose. This day page names the vaccine. The drop is written on the vaccine list.',
    unclear: false,
    sourcePage: 26,
    amountPage: 27,
    medicineKeys: ['lasota'],
    sort: 150,
  },
  {
    id: id(286),
    dayFrom: 1,
    dayTo: 1,
    dayLabel: 'Day 1',
    slot: 'full_day',
    itemName: 'Marek vaccine',
    amountText: '0.2 ml Marek vaccine.',
    unclear: false,
    sourcePage: 27,
    amountPage: null,
    medicineKeys: ['marek'],
    sort: 15,
  },
  {
    id: id(287),
    dayFrom: 28,
    dayTo: 28,
    dayLabel: 'Day 28',
    slot: 'full_day',
    itemName: 'Gumboro booster',
    amountText: 'One drop in the eye or the nose.',
    unclear: false,
    sourcePage: 27,
    amountPage: null,
    medicineKeys: ['gumboro'],
    sort: 160,
  },
  {
    id: id(288),
    dayFrom: 42,
    dayTo: 42,
    dayLabel: 'Day 42',
    slot: 'full_day',
    itemName: 'Fowl pox vaccine',
    amountText: '0.2 ml in the wing web or the neck.',
    unclear: false,
    sourcePage: 27,
    amountPage: null,
    medicineKeys: ['fowlpox'],
    sort: 170,
  },
  {
    id: id(289),
    dayFrom: 56,
    dayTo: 56,
    dayLabel: 'Day 56',
    slot: 'full_day',
    itemName: 'R2B vaccine',
    amountText: '0.5 ml in the wing web, the neck, or the breast.',
    unclear: false,
    sourcePage: 27,
    amountPage: null,
    medicineKeys: ['r2b'],
    sort: 180,
  },
  {
    id: id(290),
    dayFrom: null,
    dayTo: null,
    dayLabel: 'When the bird is 600 g',
    slot: 'full_day',
    itemName: 'Coryza vaccine',
    amountText: 'Check with the vet. The page says to give a Coryza vaccine when the bird is 600 g. It does not write an amount or a day number.',
    unclear: true,
    sourcePage: 27,
    amountPage: null,
    medicineKeys: ['coryza'],
    sort: 190,
  },
];

export function daysBetween(from: string, to: string): number {
  const [y1, m1, d1] = from.split('-').map(Number);
  const [y2, m2, d2] = to.split('-').map(Number);
  const start = Date.UTC(y1 ?? 1970, (m1 ?? 1) - 1, d1 ?? 1);
  const end = Date.UTC(y2 ?? 1970, (m2 ?? 1) - 1, d2 ?? 1);
  return Math.round((end - start) / 86_400_000);
}

/** The hatch date is day 1 on this paper. A missing or future hatch date has no paper day. */
export function paperDay(hatchDate: string | null, onDate: string): number | null {
  if (!hatchDate || hatchDate > onDate) return null;
  return daysBetween(hatchDate, onDate) + 1;
}

export function shiftDate(iso: string, days: number): string {
  const [year, month, day] = iso.split('-').map(Number);
  const date = new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function rowsOnPaperDay(day: number): PaperRow[] {
  return PAPER_ROWS.filter((row) => row.dayFrom !== null && row.dayFrom <= day && day <= (row.dayTo ?? row.dayFrom)).sort(
    (a, b) => a.sort - b.sort,
  );
}
