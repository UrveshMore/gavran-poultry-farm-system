import {
  SAATHI_VET_LABEL,
  countAccuracy,
  interpret,
  matchKnowledge,
  parsePhotoAi,
  type SaathiContext,
  type SaathiReply,
} from '@gavran/shared';
import { describe, expect, it } from 'vitest';

const owner: SaathiContext = {
  today: '2026-10-14',
  permissions: ['farm.read', 'egg.record', 'egg.read', 'loss.record', 'hatch.record', 'health.record', 'health.read', 'task.manage', 'stock.record', 'stock.read', 'sale.record', 'expense.record', 'batch.read'],
  batches: [
    { id: 'batch-a', code: 'A' },
    { id: 'batch-b', code: 'B' },
    { id: 'batch-d', code: 'D' },
  ],
  sittings: [{ id: 'sit-1', code: 'C1' }],
  items: [
    { id: 'item-mash', name: 'mash' },
    { id: 'item-dana', name: 'dana' },
  ],
  customers: [{ id: 'cust-1', name: 'Raju' }],
  categories: [{ id: 'cat-1', name: 'Table' }],
  expenseCategories: [{ id: 'exp-1', name: 'Feed' }],
  birdTypes: [{ id: 'bird-1', name: 'Desi' }],
  sheds: [{ id: 'shed-1', code: 'A1' }],
  doses: [{ rowId: 'row-1', batchId: 'batch-d', batchCode: 'D', label: 'Electrolyte' }],
};

const worker: SaathiContext = { ...owner, permissions: ['farm.read', 'egg.record', 'egg.read', 'batch.read'] };

function expectReply(text: string, check: (reply: SaathiReply) => void) {
  const reply = interpret(text, null, owner);
  expect(reply, text).not.toHaveProperty('saved');
  check(reply);
}

describe('saathi intents', () => {
  const cases: Array<{ text: string; check: (reply: SaathiReply) => void }> = [
    { text: 'collected 12 eggs for batch B today', check: (reply) => expect(reply.type === 'confirm' && reply.card.action).toBe('eggs') },
    { text: 'today 2 birds died in batch A', check: (reply) => expect(reply.type === 'confirm' && reply.card.action).toBe('loss') },
    { text: '40 chicks came out of incubator C1 today', check: (reply) => expect(reply.type === 'confirm' && reply.card.action).toBe('hatch') },
    { text: 'dose given to batch D today', check: (reply) => expect(reply.type === 'confirm' && reply.card.action).toBe('dose') },
    { text: 'job mend the fence today', check: (reply) => expect(reply.type === 'confirm' && reply.card.action).toBe('task') },
    { text: 'used 3 kg mash today', check: (reply) => expect(reply.type === 'confirm' && reply.card.action).toBe('feed') },
    { text: 'sold 10 birds to Raju for 200 today', check: (reply) => expect(reply.type === 'confirm' && reply.card.action).toBe('sale') },
    { text: 'spent 50 on feed today', check: (reply) => expect(reply.type === 'confirm' && reply.card.action).toBe('expense') },
    { text: 'which medicine for which batch today', check: (reply) => expect(reply.type === 'lookup' && reply.lookup).toBe('doses') },
    { text: 'how many birds', check: (reply) => expect(reply.type === 'lookup' && reply.lookup).toBe('counts') },
    { text: 'how many eggs today', check: (reply) => expect(reply.type === 'lookup' && reply.lookup).toBe('eggs') },
    { text: 'how much feed is left', check: (reply) => expect(reply.type === 'lookup' && reply.lookup).toBe('stock') },
    { text: 'which vaccines are due', check: (reply) => expect(reply.type === 'lookup' && reply.lookup).toBe('vaccines') },
    { text: 'how do I use eggs', check: (reply) => expect(reply.type === 'answer' && reply.speechKey).toBe('saathi.help.eggs') },
    { text: 'collected eggs today', check: (reply) => expect(reply.type === 'ask' && reply.speechKey).toBe('saathi.ask.count') },
    { text: '12 eggs today', check: (reply) => expect(reply.type === 'ask' && reply.speechKey).toBe('saathi.ask.batch') },
    { text: 'aaj batch B se 12 ande nikle', check: (reply) => expect(reply.type === 'confirm' && reply.card.action).toBe('eggs') },
    { text: 'aaj 2 murga mar gaye batch A', check: (reply) => expect(reply.type === 'confirm' && reply.card.action).toBe('loss') },
    { text: 'incubator se 40 chuze nikle aaj', check: (reply) => expect(reply.type === 'confirm' && reply.card.action).toBe('hatch') },
    { text: 'aaj batch D ko dawai di', check: (reply) => expect(reply.type === 'confirm' && reply.card.action).toBe('dose') },
    { text: 'aaj kaam baad band karo', check: (reply) => expect(reply.type === 'confirm' && reply.card.action).toBe('task') },
    { text: 'aaj 3 kg dana use kiya', check: (reply) => expect(reply.type === 'confirm' && reply.card.action).toBe('feed') },
    { text: 'aaj Raju ko 10 birds beche 200', check: (reply) => expect(reply.type === 'confirm' && reply.card.action).toBe('sale') },
    { text: 'aaj 50 kharch kiya', check: (reply) => expect(reply.type === 'confirm' && reply.card.action).toBe('expense') },
    { text: 'aaj kaunsi dawai kis batch ko', check: (reply) => expect(reply.type === 'lookup' && reply.lookup).toBe('doses') },
    { text: 'kitne pakshi hain', check: (reply) => expect(reply.type === 'lookup' && reply.lookup).toBe('counts') },
    { text: 'dana kitna bacha hai', check: (reply) => expect(reply.type === 'lookup' && reply.lookup).toBe('stock') },
    { text: 'kaunsa vaccine due hai', check: (reply) => expect(reply.type === 'lookup' && reply.lookup).toBe('vaccines') },
    { text: 'ande kaise likhun', check: (reply) => expect(reply.type === 'answer' && reply.speechKey).toBe('saathi.help.eggs') },
    { text: 'आज 12 अंडे बैच B', check: (reply) => expect(reply.type === 'confirm' && reply.card.action).toBe('eggs') },
    { text: 'aaj batch B madhun 12 andi', check: (reply) => expect(reply.type === 'confirm' && reply.card.action).toBe('eggs') },
    { text: 'aaj 2 murgi mele batch A', check: (reply) => expect(reply.type === 'confirm' && reply.card.action).toBe('loss') },
    { text: 'aaj incubator madhun 40 pilav nighali', check: (reply) => expect(reply.type === 'confirm' && reply.card.action).toBe('hatch') },
    { text: 'aaj batch D la aushadh dile', check: (reply) => expect(reply.type === 'confirm' && reply.card.action).toBe('dose') },
    { text: 'aaj kaam gardi band kara', check: (reply) => expect(reply.type === 'confirm' && reply.card.action).toBe('task') },
    { text: 'aaj 3 kg mash vaparle', check: (reply) => expect(reply.type === 'confirm' && reply.card.action).toBe('feed') },
    { text: 'aaj Raju la 10 pakshi vikle 200', check: (reply) => expect(reply.type === 'confirm' && reply.card.action).toBe('sale') },
    { text: 'aaj 50 kharch feed', check: (reply) => expect(reply.type === 'confirm' && reply.card.action).toBe('expense') },
    { text: 'aaj konati aushadh konata batch', check: (reply) => expect(reply.type === 'lookup' && reply.lookup).toBe('doses') },
    { text: 'kiti pakshi ahet', check: (reply) => expect(reply.type === 'lookup' && reply.lookup).toBe('counts') },
    { text: 'khad kiti urle', check: (reply) => expect(reply.type === 'lookup' && reply.lookup).toBe('stock') },
    { text: 'konati las due aahe', check: (reply) => expect(reply.type === 'lookup' && reply.lookup).toBe('vaccines') },
    { text: 'andi kase lihayche', check: (reply) => expect(reply.type === 'answer' && reply.speechKey).toBe('saathi.help.eggs') },
    { text: 'आज 12 अंडी बैच B', check: (reply) => expect(reply.type === 'confirm' && reply.card.action).toBe('eggs') },
    { text: 'hello there', check: (reply) => expect(reply.type === 'answer' && reply.speechKey).toBe('saathi.say.hello') },
  ];

  it('matches the authored utterances in English, Hindi, and Marathi', () => {
    expect(cases).toHaveLength(45);
    for (const row of cases) row.check(interpret(row.text, null, owner));
    expect(countAccuracy([{ predicted: 3, known: 3 }, { predicted: 4, known: 5 }])).toEqual({ exact: 1, withinOne: 2, total: 2 });
  });

  it('asks which flock, then confirms, and still has not saved', () => {
    const first = interpret('12 eggs', null, owner);
    expect(first.type).toBe('ask');
    if (first.type !== 'ask') return;
    expect(first.speechKey).toBe('saathi.ask.date');
    const dated = interpret('today', first.pending, owner);
    expect(dated.type).toBe('ask');
    if (dated.type !== 'ask') return;
    expect(dated.speechKey).toBe('saathi.ask.batch');
    const ready = interpret('batch B', dated.pending, owner);
    expect(ready.type).toBe('confirm');
    if (ready.type !== 'confirm') return;
    expect(ready.card.fields.find((field) => field.key === 'eggCount')?.value).toBe('12');
    expect(ready.card.fields.find((field) => field.key === 'batchId')?.value).toBe('batch-b');
    expect(JSON.stringify(ready)).not.toContain('"saved":true');
  });

  it('asks which expense sort when the farm has more than one', () => {
    const two = { ...owner, expenseCategories: [...owner.expenseCategories, { id: 'exp-2', name: 'Litter' }] };
    const reply = interpret('aaj 50 kharch kiya', null, two);
    expect(reply.type === 'ask' && reply.speechKey).toBe('saathi.ask.category');
  });

  it('refuses a sale for a worker and keeps a low-confidence line as a question', () => {
    expect(interpret('sold 10 birds to Raju for 200 today', null, worker).type).toBe('denied');
    expectReply('12 eggs for batch B today', (reply) => {
      expect(reply.type).toBe('confirm');
    });
  });

  it('matches only the farm papers and drops a dose the model invented', () => {
    const matches = matchKnowledge('blood in droppings', [
      {
        id: '1',
        title: 'Supercox',
        sourceFile: 'patil-poultry-antibiotics.pdf',
        sourcePage: 8,
        symptoms: '',
        usedFor: 'coccidiosis blood in droppings',
        howToGive: '1 to 2 g in 1 to 2 litres, as written on the page',
        scheduleText: '3 to 5 days',
      },
    ]);
    expect(matches).toHaveLength(1);
    expect(matches[0]?.label).toBe(SAATHI_VET_LABEL);
    expect(matches[0]?.howToGive).toBe('1 to 2 g in 1 to 2 litres, as written on the page');
    expect(matches[0]).not.toHaveProperty('dose');
    expect(matchKnowledge('purple spots on the moon', matches)).toEqual([]);
    const photo = parsePhotoAi({ count: 28, confidence: 0.4, boxes: [], ageRange: null, signs: ['soft droppings'], dose: '999 mg' });
    expect(photo?.count).toBe(28);
    expect(photo).not.toHaveProperty('dose');
    expect(parsePhotoAi({ count: -1, confidence: 2, boxes: [], ageRange: null, signs: [] })).toBeNull();
  });
});
