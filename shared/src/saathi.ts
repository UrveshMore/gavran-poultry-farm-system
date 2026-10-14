import { z } from 'zod';

/** Gavran Saathi. A draft is not a save. Commit is a separate step. */

export const SAATHI_VET_LABEL = 'possible - confirm with vet';
export const SAATHI_MIN_CONFIDENCE = 0.6;

export const SAATHI_ACTIONS = ['eggs', 'loss', 'hatch', 'dose', 'task', 'feed', 'sale', 'expense'] as const;
export type SaathiAction = (typeof SAATHI_ACTIONS)[number];

export type SaathiKind = SaathiAction | 'ask_doses' | 'ask_counts' | 'ask_eggs' | 'ask_stock' | 'ask_vaccines' | 'help' | 'unknown';

export type Intent = {
  kind: SaathiKind;
  confidence: number;
  count: number | null;
  amount: number | null;
  batchCode: string | null;
  date: string | null;
  dateAmbiguous: boolean;
  title: string;
  section: string | null;
  note: string;
};

export type Named = { id: string; name: string };
export type Coded = { id: string; code: string };
export type DueDose = { rowId: string; batchId: string; batchCode: string; label: string };

export type SaathiContext = {
  today: string;
  permissions: readonly string[];
  batches: Coded[];
  sittings: Coded[];
  items: Named[];
  customers: Named[];
  categories: Named[];
  expenseCategories: Named[];
  birdTypes: Named[];
  sheds: Coded[];
  doses: DueDose[];
};

export type Choice = { id: string; label: string };

export type SaathiCard = {
  action: SaathiAction;
  confidence: number;
  fields: { key: string; value: string }[];
  choices: Record<string, Choice[]>;
};

export type SaathiReply =
  | { type: 'confirm'; speechKey: string; vars: Record<string, string>; card: SaathiCard }
  | { type: 'ask'; speechKey: string; vars: Record<string, string>; pending: Intent }
  | { type: 'lookup'; lookup: 'doses' | 'counts' | 'eggs' | 'stock' | 'vaccines' }
  | { type: 'answer'; speechKey: string; vars: Record<string, string> }
  | { type: 'denied'; speechKey: 'saathi.denied'; vars: Record<string, string> };

export type KbEntry = {
  id: string;
  title: string;
  sourceFile: string;
  sourcePage: number;
  symptoms: string;
  usedFor: string;
  howToGive: string;
  scheduleText: string;
};

export type KbMatch = KbEntry & { label: typeof SAATHI_VET_LABEL; amountOnPage: boolean };

const NEED: Record<SaathiKind, string> = {
  eggs: 'egg.record',
  loss: 'loss.record',
  hatch: 'hatch.record',
  dose: 'health.record',
  task: 'task.manage',
  feed: 'stock.record',
  sale: 'sale.record',
  expense: 'expense.record',
  ask_doses: 'health.read',
  ask_counts: 'batch.read',
  ask_eggs: 'egg.read',
  ask_stock: 'stock.read',
  ask_vaccines: 'health.read',
  help: 'farm.read',
  unknown: 'farm.read',
};

const DEV = '०१२३४५६७८९';

export function blankIntent(note = ''): Intent {
  return {
    kind: 'unknown',
    confidence: 0.2,
    count: null,
    amount: null,
    batchCode: null,
    date: null,
    dateAmbiguous: false,
    title: '',
    section: null,
    note,
  };
}

function digits(text: string): string {
  return text.replace(/[०-९]/g, (ch) => String(DEV.indexOf(ch)));
}

function fold(text: string): string {
  return digits(text).toLowerCase().replace(/[।.,!?]/g, ' ').replace(/\s+/g, ' ').trim();
}

function has(text: string, words: readonly string[]): boolean {
  return words.some((word) => text.includes(word));
}

function numbers(text: string): number[] {
  return [...text.matchAll(/\d+/g)].map((hit) => Number(hit[0])).filter((value) => Number.isFinite(value));
}

function shiftDate(iso: string, days: number): string {
  const [year, month, day] = iso.split('-').map(Number);
  const date = new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function readDate(text: string, today: string, intent: Intent) {
  const iso = text.match(/\d{4}-\d{2}-\d{2}/);
  if (iso) {
    intent.date = iso[0];
    return;
  }
  if (has(text, ['today', 'aaj']) || text.includes('आज')) {
    intent.date = today;
    return;
  }
  if (/\byesterday\b/.test(text) || text.includes('gata kal')) {
    intent.date = shiftDate(today, -1);
    return;
  }
  if (/\bkal\b/.test(text) || text.includes('कल')) intent.dateAmbiguous = true;
}

function readBatch(text: string, intent: Intent) {
  const hit = text.match(/(?:batch|flock|बैच|झुंड|थवा)\s+([a-z0-9_-]+)/i);
  if (hit?.[1]) intent.batchCode = hit[1].toUpperCase();
}

function sectionOf(text: string): string {
  if (has(text, ['egg', 'ande', 'andi', 'अंडे', 'अंडी'])) return 'eggs';
  if (has(text, ['loss', 'death', 'mar ', 'mele', 'नुकसान'])) return 'losses';
  if (has(text, ['hatch', 'chick', 'chuze', 'pilav', 'पिल्ले'])) return 'hatch';
  if (has(text, ['dawai', 'medicine', 'aushadh', 'दवा', 'औषध', 'health'])) return 'health';
  if (has(text, ['task', 'job', 'kaam', 'काम'])) return 'tasks';
  if (has(text, ['feed', 'stock', 'dana', 'khad', 'दाना', 'खाद'])) return 'stock';
  if (has(text, ['sale', 'sold', 'bech', 'विक'])) return 'sales';
  if (has(text, ['expense', 'spent', 'kharch', 'खर्च'])) return 'expenses';
  return 'saathi';
}

function titleFrom(text: string): string {
  return text
    .replace(/\b(today|aaj|yesterday|job|task|kaam|काम)\b/gi, ' ')
    .replace(/आज/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 160);
}

export function parseUtterance(raw: string, today: string): Intent {
  const text = fold(raw);
  const intent = blankIntent(raw.trim().slice(0, 500));
  const nums = numbers(text);
  readDate(text, today, intent);
  readBatch(text, intent);
  const question = has(text, [
    'which',
    'how many',
    'how much',
    'how do',
    'kaunsi',
    'kaunsa',
    'kaun ',
    'kitne',
    'kitna',
    'kiti ',
    'konati',
    'konata',
    'किती',
    'कितने',
    'कौनसी',
    'कोणती',
    'कसे',
    'कैसे',
    'kaise',
    'kase ',
  ]);
  if (has(text, ['how do', 'kaise', 'kase ', 'कैसे', 'कसे'])) {
    intent.kind = 'help';
    intent.section = sectionOf(text);
    intent.confidence = 0.9;
    return intent;
  }
  if (question && has(text, ['dawai', 'medicine', 'aushadh', 'dose', 'दवा', 'औषध'])) {
    intent.kind = 'ask_doses';
    intent.confidence = 0.9;
    return intent;
  }
  if (question && has(text, ['vaccine', 'las ', 'टिक', 'लस'])) {
    intent.kind = 'ask_vaccines';
    intent.confidence = 0.9;
    return intent;
  }
  if (question && has(text, ['stock', 'feed', 'dana', 'khad', 'दाना', 'खाद'])) {
    intent.kind = 'ask_stock';
    intent.confidence = 0.9;
    return intent;
  }
  if (question && has(text, ['egg', 'ande', 'andi', 'अंडे', 'अंडी'])) {
    intent.kind = 'ask_eggs';
    intent.confidence = 0.9;
    return intent;
  }
  if (question && has(text, ['bird', 'pakshi', 'murg', 'पक्षी', 'count'])) {
    intent.kind = 'ask_counts';
    intent.confidence = 0.9;
    return intent;
  }
  if (has(text, ['spent', 'kharch', 'खर्च', 'expense'])) {
    intent.kind = 'expense';
    intent.amount = nums[0] ?? null;
    intent.confidence = 0.9;
    return intent;
  }
  if (has(text, ['sold', 'sale', 'bech', 'vikl', 'विक'])) {
    intent.kind = 'sale';
    intent.count = nums[0] ?? null;
    intent.amount = nums[1] ?? null;
    intent.confidence = 0.9;
    return intent;
  }
  if (has(text, ['kg', 'kilo', 'mash', 'dana', 'khad', 'दाना', 'खाद', 'feed used', 'used'])) {
    if (has(text, ['kg', 'kilo', 'mash', 'dana', 'khad', 'दाना', 'खाद', 'feed'])) {
      intent.kind = 'feed';
      intent.count = nums[0] ?? null;
      intent.confidence = 0.9;
      return intent;
    }
  }
  if (has(text, ['egg', 'ande', 'andi', 'अंडे', 'अंडी'])) {
    intent.kind = 'eggs';
    intent.count = nums[0] ?? null;
    intent.confidence = 0.9;
    return intent;
  }
  if (has(text, ['chick', 'chuze', 'pilav', 'पिल्ले', 'hatch'])) {
    intent.kind = 'hatch';
    intent.count = nums[0] ?? null;
    intent.confidence = 0.9;
    return intent;
  }
  if (has(text, ['died', 'death', 'mar gaye', 'mar gae', 'murga mar', 'mele', 'मरे', 'नुकसान', 'loss'])) {
    intent.kind = 'loss';
    intent.count = nums[0] ?? null;
    intent.confidence = 0.9;
    return intent;
  }
  if (has(text, ['dose', 'dawai di', 'dawai de', 'aushadh', 'दवा दी', 'औषध दि'])) {
    intent.kind = 'dose';
    intent.confidence = 0.9;
    return intent;
  }
  if (has(text, ['task', 'job', 'kaam', 'काम'])) {
    intent.kind = 'task';
    intent.title = titleFrom(text);
    intent.confidence = intent.title.length >= 2 ? 0.9 : 0.4;
    return intent;
  }
  return intent;
}

function can(ctx: SaathiContext, kind: SaathiKind): boolean {
  return ctx.permissions.includes(NEED[kind]);
}

function ask(speechKey: string, pending: Intent, vars: Record<string, string> = {}): SaathiReply {
  return { type: 'ask', speechKey, vars, pending };
}

function confirm(speechKey: string, card: SaathiCard, vars: Record<string, string>): SaathiReply {
  return { type: 'confirm', speechKey, vars, card };
}

function matchCode(code: string | null, rows: Coded[]): Coded | null {
  if (!code) return null;
  return rows.find((row) => row.code.toLowerCase() === code.toLowerCase()) ?? null;
}

function matchName(note: string, rows: Named[]): Named | null {
  const text = fold(note);
  const hits = rows.filter((row) => row.name.trim().length >= 3 && text.includes(row.name.toLowerCase()));
  return hits.length === 1 ? hits[0] ?? null : null;
}

function sittingOf(note: string, rows: Coded[]): Coded | null {
  const text = fold(note);
  const direct = rows.filter((row) => row.code.length >= 2 && new RegExp(`(?:^|\\s)${row.code.toLowerCase()}(?:\\s|$)`).test(text));
  if (direct.length === 1) return direct[0] ?? null;
  return null;
}

function card(action: SaathiAction, confidence: number, fields: { key: string; value: string }[], choices: Record<string, Choice[]> = {}): SaathiCard {
  return { action, confidence, fields, choices };
}

function choicesOf(rows: Array<{ id: string; label: string }>): Choice[] {
  return rows.map((row) => ({ id: row.id, label: row.label }));
}

export function interpret(raw: string, pending: Intent | null, ctx: SaathiContext): SaathiReply {
  const parsed = parseUtterance(raw, ctx.today);
  let intent = parsed;
  if (pending && parsed.kind === 'unknown') {
    intent = { ...pending, note: `${pending.note} ${raw}`.trim().slice(0, 500) };
    if (parsed.date) intent.date = parsed.date;
    if (parsed.dateAmbiguous) intent.dateAmbiguous = true;
    if (parsed.batchCode) intent.batchCode = parsed.batchCode;
    if (parsed.count !== null && intent.count === null) intent.count = parsed.count;
    if (parsed.amount !== null && intent.amount === null) intent.amount = parsed.amount;
    const named = raw.trim();
    if (intent.kind === 'eggs' && matchName(named, ctx.categories)) intent.note = `${intent.note} ${named}`;
    intent.confidence = Math.max(intent.confidence, 0.75);
  } else if (pending && parsed.kind === pending.kind) {
    intent = {
      ...pending,
      ...parsed,
      count: parsed.count ?? pending.count,
      amount: parsed.amount ?? pending.amount,
      batchCode: parsed.batchCode ?? pending.batchCode,
      date: parsed.date ?? pending.date,
      dateAmbiguous: parsed.dateAmbiguous || (parsed.date ? false : pending.dateAmbiguous),
      title: parsed.title || pending.title,
      note: raw.trim().slice(0, 500),
    };
  }
  return resolveIntent(intent, ctx);
}

export function resolveIntent(intent: Intent, ctx: SaathiContext): SaathiReply {
  if (intent.kind === 'unknown' || intent.confidence < SAATHI_MIN_CONFIDENCE) {
    return ask('saathi.ask.unclear', intent.kind === 'unknown' ? blankIntent(intent.note) : intent);
  }
  if (!can(ctx, intent.kind)) return { type: 'denied', speechKey: 'saathi.denied', vars: {} };
  if (intent.kind === 'help') return { type: 'answer', speechKey: `saathi.help.${intent.section ?? 'saathi'}`, vars: {} };
  if (intent.kind === 'ask_doses') return { type: 'lookup', lookup: 'doses' };
  if (intent.kind === 'ask_counts') return { type: 'lookup', lookup: 'counts' };
  if (intent.kind === 'ask_eggs') return { type: 'lookup', lookup: 'eggs' };
  if (intent.kind === 'ask_stock') return { type: 'lookup', lookup: 'stock' };
  if (intent.kind === 'ask_vaccines') return { type: 'lookup', lookup: 'vaccines' };
  if (intent.dateAmbiguous || !intent.date) return ask('saathi.ask.date', intent);
  if (intent.kind === 'eggs') return resolveEggs(intent, ctx);
  if (intent.kind === 'loss') return resolveLoss(intent, ctx);
  if (intent.kind === 'hatch') return resolveHatch(intent, ctx);
  if (intent.kind === 'dose') return resolveDose(intent, ctx);
  if (intent.kind === 'task') return resolveTask(intent);
  if (intent.kind === 'feed') return resolveFeed(intent, ctx);
  if (intent.kind === 'sale') return resolveSale(intent, ctx);
  if (intent.kind === 'expense') return resolveExpense(intent, ctx);
  return ask('saathi.ask.unclear', intent);
}

function batchField(intent: Intent, ctx: SaathiContext): { id: string; code: string } | 'ask' | 'none' {
  if (ctx.batches.length === 0) return 'none';
  const found = matchCode(intent.batchCode, ctx.batches);
  if (found) return found;
  if (intent.batchCode) return 'ask';
  if (ctx.batches.length === 1) return ctx.batches[0] ?? 'ask';
  return 'ask';
}

function resolveEggs(intent: Intent, ctx: SaathiContext): SaathiReply {
  if (intent.count === null) return ask('saathi.ask.count', intent);
  const batch = batchField(intent, ctx);
  if (batch === 'ask') return ask('saathi.ask.batch', intent);
  const category = matchName(intent.note, ctx.categories) ?? (ctx.categories.length === 1 ? ctx.categories[0] : null);
  if (!category) return ask('saathi.ask.category', intent);
  const code = batch === 'none' ? '' : batch.code;
  return confirm(
    'saathi.say.eggs',
    card('eggs', intent.confidence, [
      { key: 'collectedOn', value: intent.date ?? '' },
      { key: 'batchId', value: batch === 'none' ? '' : batch.id },
      { key: 'categoryId', value: category.id },
      { key: 'eggCount', value: String(intent.count) },
      { key: 'notes', value: '' },
    ], {
      batchId: choicesOf(ctx.batches.map((row) => ({ id: row.id, label: row.code }))),
      categoryId: choicesOf(ctx.categories.map((row) => ({ id: row.id, label: row.name }))),
    }),
    { count: String(intent.count), batch: code || '—', date: intent.date ?? '' },
  );
}

function resolveLoss(intent: Intent, ctx: SaathiContext): SaathiReply {
  if (intent.count === null) return ask('saathi.ask.count', intent);
  const batch = batchField(intent, ctx);
  if (batch === 'ask') return ask('saathi.ask.batch', intent);
  const note = intent.note.trim();
  if (note.length < 1) return ask('saathi.ask.unclear', intent);
  return confirm(
    'saathi.say.loss',
    card('loss', intent.confidence, [
      { key: 'occurredOn', value: intent.date ?? '' },
      { key: 'birdCount', value: String(intent.count) },
      { key: 'note', value: note },
      { key: 'batchId', value: batch === 'none' ? '' : batch.id },
    ]),
    { count: String(intent.count), batch: batch === 'none' ? '—' : batch.code, date: intent.date ?? '' },
  );
}

function resolveHatch(intent: Intent, ctx: SaathiContext): SaathiReply {
  if (intent.count === null) return ask('saathi.ask.count', intent);
  const sitting = sittingOf(intent.note, ctx.sittings) ?? (ctx.sittings.length === 1 ? ctx.sittings[0] : null);
  if (!sitting) return ask('saathi.ask.sitting', intent);
  const bird = ctx.birdTypes.length === 1 ? ctx.birdTypes[0] : null;
  const shed = ctx.sheds.length === 1 ? ctx.sheds[0] : null;
  return confirm(
    'saathi.say.hatch',
    card(
      'hatch',
      intent.confidence,
      [
        { key: 'sittingId', value: sitting.id },
        { key: 'hatchedOn', value: intent.date ?? '' },
        { key: 'eggsSet', value: String(intent.count) },
        { key: 'liveChicks', value: String(intent.count) },
        { key: 'losses', value: '0' },
        { key: 'otherCount', value: '0' },
        { key: 'differenceNote', value: '' },
        { key: 'batchCode', value: '' },
        { key: 'birdTypeId', value: bird?.id ?? '' },
        { key: 'shedId', value: shed?.id ?? '' },
      ],
      {
        sittingId: choicesOf(ctx.sittings.map((row) => ({ id: row.id, label: row.code }))),
        birdTypeId: choicesOf(ctx.birdTypes.map((row) => ({ id: row.id, label: row.name }))),
        shedId: choicesOf(ctx.sheds.map((row) => ({ id: row.id, label: row.code }))),
      },
    ),
    { count: String(intent.count), batch: sitting.code, date: intent.date ?? '' },
  );
}

function resolveDose(intent: Intent, ctx: SaathiContext): SaathiReply {
  const batch = batchField(intent, ctx);
  if (batch === 'ask' || batch === 'none') return ask('saathi.ask.batch', intent);
  const lines = ctx.doses.filter((row) => row.batchCode.toLowerCase() === batch.code.toLowerCase());
  const named = lines.filter((row) => fold(intent.note).includes(row.label.toLowerCase()) && row.label.length >= 3);
  const line = named.length === 1 ? named[0] : lines.length === 1 ? lines[0] : null;
  if (!line) return ask(lines.length === 0 ? 'saathi.ask.noDose' : 'saathi.ask.unclear', intent);
  return confirm(
    'saathi.say.dose',
    card('dose', intent.confidence, [
      { key: 'batchId', value: line.batchId },
      { key: 'rowId', value: line.rowId },
      { key: 'givenOn', value: intent.date ?? '' },
      { key: 'label', value: line.label },
    ]),
    { count: '1', batch: batch.code, date: intent.date ?? '' },
  );
}

function resolveTask(intent: Intent): SaathiReply {
  if (intent.title.trim().length < 2) return ask('saathi.ask.unclear', intent);
  return confirm(
    'saathi.say.task',
    card('task', intent.confidence, [
      { key: 'title', value: intent.title },
      { key: 'dueOn', value: intent.date ?? '' },
      { key: 'instructions', value: '' },
    ]),
    { count: '1', batch: intent.title, date: intent.date ?? '' },
  );
}

function resolveFeed(intent: Intent, ctx: SaathiContext): SaathiReply {
  if (intent.count === null) return ask('saathi.ask.count', intent);
  const item = matchName(intent.note, ctx.items) ?? (ctx.items.length === 1 ? ctx.items[0] : null);
  if (!item) return ask('saathi.ask.item', intent);
  const batch = batchField(intent, ctx);
  return confirm(
    'saathi.say.feed',
    card('feed', intent.confidence, [
      { key: 'itemId', value: item.id },
      { key: 'quantity', value: String(intent.count) },
      { key: 'occurredOn', value: intent.date ?? '' },
      { key: 'batchId', value: batch === 'ask' || batch === 'none' ? '' : batch.id },
    ], { itemId: choicesOf(ctx.items.map((row) => ({ id: row.id, label: row.name }))) }),
    { count: String(intent.count), batch: item.name, date: intent.date ?? '' },
  );
}

function resolveSale(intent: Intent, ctx: SaathiContext): SaathiReply {
  if (intent.count === null) return ask('saathi.ask.count', intent);
  if (intent.amount === null) return ask('saathi.ask.unclear', intent);
  const customer = matchName(intent.note, ctx.customers) ?? (ctx.customers.length === 1 ? ctx.customers[0] : null);
  if (!customer) return ask('saathi.ask.customer', intent);
  return confirm(
    'saathi.say.sale',
    card('sale', intent.confidence, [
      { key: 'customerId', value: customer.id },
      { key: 'orderedOn', value: intent.date ?? '' },
      { key: 'description', value: 'birds' },
      { key: 'quantity', value: String(intent.count) },
      { key: 'unitPrice', value: String(intent.amount) },
    ], { customerId: choicesOf(ctx.customers.map((row) => ({ id: row.id, label: row.name }))) }),
    { count: String(intent.count), batch: customer.name, date: intent.date ?? '' },
  );
}

function resolveExpense(intent: Intent, ctx: SaathiContext): SaathiReply {
  if (intent.amount === null) return ask('saathi.ask.count', intent);
  const category = matchName(intent.note, ctx.expenseCategories) ?? (ctx.expenseCategories.length === 1 ? ctx.expenseCategories[0] : null);
  if (!category) return ask('saathi.ask.category', intent);
  return confirm(
    'saathi.say.expense',
    card(
      'expense',
      intent.confidence,
      [
        { key: 'occurredOn', value: intent.date ?? '' },
        { key: 'categoryId', value: category.id },
        { key: 'amount', value: String(intent.amount) },
        { key: 'unitLabel', value: '' },
        { key: 'notes', value: intent.note },
        { key: 'batchId', value: '' },
      ],
      { categoryId: choicesOf(ctx.expenseCategories.map((row) => ({ id: row.id, label: row.name }))) },
    ),
    { count: String(intent.amount), batch: category.name, date: intent.date ?? '' },
  );
}

export function fieldValue(card: SaathiCard, key: string): string {
  return card.fields.find((field) => field.key === key)?.value ?? '';
}

export function withField(card: SaathiCard, key: string, value: string): SaathiCard {
  const fields = card.fields.some((field) => field.key === key)
    ? card.fields.map((field) => (field.key === key ? { ...field, value } : field))
    : [...card.fields, { key, value }];
  return { ...card, fields };
}

const tokens = (text: string) =>
  fold(text)
    .split(' ')
    .map((word) => word.trim())
    .filter((word) => word.length >= 3);

export function matchKnowledge(text: string, entries: readonly KbEntry[]): KbMatch[] {
  const wanted = new Set(tokens(text));
  const scored = entries
    .map((entry) => {
      const hay = tokens(`${entry.title} ${entry.symptoms} ${entry.usedFor}`);
      const score = hay.filter((word) => wanted.has(word)).length;
      return { entry, score };
    })
    .filter((row) => row.score >= 2)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
  return scored.map(({ entry }) => ({
    ...entry,
    howToGive: entry.howToGive,
    label: SAATHI_VET_LABEL,
    amountOnPage: entry.howToGive.trim().length > 0,
  }));
}

export function stripInventedCare(value: unknown): unknown {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
  const copy = { ...(value as Record<string, unknown>) };
  for (const key of ['medicine', 'dose', 'dosage', 'howToGive', 'treatment']) delete copy[key];
  return copy;
}

export const photoAiSchema = z.object({
  count: z.number().int().min(0).max(100_000).nullable(),
  confidence: z.number().min(0).max(1),
  boxes: z
    .array(
      z.object({
        x: z.number().min(0).max(1),
        y: z.number().min(0).max(1),
        w: z.number().min(0).max(1),
        h: z.number().min(0).max(1),
      }),
    )
    .max(300),
  ageRange: z.string().max(80).nullable(),
  signs: z.array(z.string().max(200)).max(12),
  unavailable: z.boolean().optional(),
});

export type PhotoAi = z.infer<typeof photoAiSchema>;

export function parsePhotoAi(value: unknown): PhotoAi | null {
  const parsed = photoAiSchema.safeParse(stripInventedCare(value));
  return parsed.success ? parsed.data : null;
}

export function countAccuracy(rows: readonly { predicted: number; known: number }[]): { exact: number; withinOne: number; total: number } {
  let exact = 0;
  let withinOne = 0;
  for (const row of rows) {
    if (row.predicted === row.known) exact += 1;
    if (Math.abs(row.predicted - row.known) <= 1) withinOne += 1;
  }
  return { exact, withinOne, total: rows.length };
}
