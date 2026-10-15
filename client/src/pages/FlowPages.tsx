import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bird, Egg, Home, Pill, Thermometer, Wheat, Wallet, type LucideIcon } from 'lucide-react';
import { useState, type FormEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import { Chip, Fab, PageHead, Pills, SearchRow, Sheet, Tile, Tip } from '@/components/Look';
import { Alert, Button, Card, Field, Input, Splash } from '@/components/ui';
import { ApiError, api } from '@/lib/api';

type Slot = 'morning' | 'evening' | 'full_day';
type DoseLine = {
  rowId: string;
  dayLabel: string;
  slot: Slot;
  itemName: string;
  amountText: string;
  unclear: boolean;
  sourcePage: number;
  given: boolean;
  markId: string | null;
  givenOn: string | null;
};
type Board = {
  today: string;
  scheduleFound: boolean;
  scheduleSource: string | null;
  season: 'not_in_source';
  setup: { incubatorsReady: boolean; hasShed: boolean; hasBatch0: boolean; batch0Skipped: boolean };
  incubators: { id: string; name: string; capacity: number; eggsInUse: number; overCapacity: boolean }[];
  sheds: { id: string; name: string; capacity: number; birdCount: number; overCapacity: boolean }[];
  batches: {
    id: string;
    number: number;
    incubatorId: string | null;
    eggsSet: number | null;
    setOn: string | null;
    hatchOn: string | null;
    liveTotal: number;
    bad: number | null;
    ratio: number | null;
    ratioBasis: 'not_set';
    broodingLive: number;
    ageDays: number | null;
    moveReminder: boolean;
    placements: { shedId: string; shedName: string; birdCount: number }[];
    hatchDays: { id: string; dayNumber: number; liveCount: number; runningTotal: number }[];
    medicine: { ageDays: number | null; today: DoseLine[]; nextDay: number | null; next: DoseLine[]; vet: DoseLine[] };
  }[];
  doseMarks: { id: string; batchId: string; scheduleRowId: string; givenOn: string | null; notes: string | null }[];
  feed: { id: string; batchId: string; batchNumber: number | null; occurredOn: string | null; ageDay: number | null; seasonLabel: string; feedType: string; quantity: number; unitLabel: string; notes: string | null }[];
  eggs: { id: string; occurredOn: string | null; collected: number; sold: number; forIncubator: number; notes: string | null }[];
  eggStock: number;
  expenses: { id: string; occurredOn: string | null; category: 'feed' | 'medicine' | 'electricity' | 'other'; amount: number; unitLabel: string; notes: string | null }[];
  sales: { id: string; occurredOn: string | null; kind: 'eggs' | 'birds'; quantity: number; price: number; amount: number; buyer: string; unitLabel: string; batchId: string | null; moveId: string | null; notes: string | null }[];
  home: {
    broodingCount: number;
    shedCount: number;
    todayMedicine: { batchId: string; batchNumber: number; rowId: string; itemName: string; slot: Slot; amountText: string; given: boolean }[];
    todayFeed: { id: string; batchNumber: number | null; feedType: string; quantity: number; unitLabel: string }[];
    todayEggs: number;
    month: { unit: string; sales: number; expenses: number; difference: number; basis: 'not_set' }[];
  };
};

const box = 'min-h-11 w-full rounded-xl border border-line bg-white px-3 text-base text-ink';
const bottles = ['/art/pill.jpg', '/art/bottle-green.jpg', '/art/bottle-blue.jpg', '/art/bottle-purple.jpg'];
const tints = ['#E8F6EA', '#E7F3E4', '#E7F1FA', '#F4E9F8'];

function problem(error: unknown): string {
  return error instanceof ApiError ? error.message : 'The computer did not answer.';
}

function daysSince(today: string, from: string | null): number | null {
  if (!from) return null;
  const start = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${today}T00:00:00Z`);
  if (Number.isNaN(start) || Number.isNaN(end)) return null;
  return Math.round((end - start) / 86400000) + 1;
}

function useBoard(farmId: string) {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ['flow', farmId], queryFn: () => api<Board>(`/api/v1/farms/${farmId}/flow`) });
  return {
    ...query,
    refresh: () => queryClient.invalidateQueries({ queryKey: ['flow', farmId] }),
  };
}

function Actions({ editId, onEdit, onDelete }: { editId: string; onEdit: () => void; onDelete: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="flex gap-2">
      <Button type="button" variant="outline" className="min-h-9 rounded-full px-3 text-sm" data-edit={editId} onClick={onEdit}>
        {t('flow.action.edit')}
      </Button>
      <Button
        type="button"
        variant="ghost"
        className="min-h-9 rounded-full px-3 text-sm"
        data-delete={editId}
        onClick={() => {
          if (window.confirm(t('flow.action.confirmDelete'))) onDelete();
        }}
      >
        {t('flow.action.delete')}
      </Button>
    </div>
  );
}

function useSave(farmId: string, refresh: () => Promise<unknown>) {
  const [error, setError] = useState<string | null>(null);
  const mutation = useMutation({
    mutationFn: async (job: { method: 'POST' | 'PATCH' | 'DELETE'; path: string; body?: unknown }) => {
      setError(null);
      await api(`/api/v1/farms/${farmId}${job.path}`, { method: job.method, json: job.body });
    },
    onSuccess: () => void refresh(),
    onError: (err) => setError(problem(err)),
  });
  return { error, pending: mutation.isPending, run: mutation.mutateAsync };
}

function Page({ farmId, screen, children }: { farmId: string; screen: string; children: (board: Board, save: ReturnType<typeof useSave>) => ReactNode }) {
  const { t } = useTranslation();
  const board = useBoard(farmId);
  const save = useSave(farmId, board.refresh);
  if (board.isLoading) return <Splash />;
  if (board.isError || !board.data) {
    return (
      <div className="grid gap-3" data-flow={screen}>
        <Alert>{problem(board.error)}</Alert>
        <Button type="button" onClick={() => void board.refetch()}>
          {t('common.retry')}
        </Button>
      </div>
    );
  }
  return (
    <div className="grid gap-4" data-flow={screen}>
      {save.error ? <Alert>{save.error}</Alert> : null}
      {children(board.data, save)}
    </div>
  );
}

function needFarm() {
  return <Splash />;
}

function TileStat({ stat, label, value }: { stat: string; label: string; value: ReactNode }) {
  return (
    <div className="rounded-2xl bg-white px-2 py-3 text-center shadow-[0_8px_28px_rgba(31,77,43,0.06)]" data-stat={stat}>
      <p className="text-[11px] font-medium leading-tight text-ink-soft">{label}</p>
      <p className="mt-1 font-display text-[1.35rem] font-semibold leading-none text-ink" data-value={stat}>
        {value}
      </p>
    </div>
  );
}

export function FlowHomePage() {
  const { farmId } = useParams();
  const { t } = useTranslation();
  if (!farmId) return needFarm();
  const base = `/farms/${farmId}`;
  const actions: { to: string; icon: LucideIcon; label: string }[] = [
    { to: `${base}/flow/eggs`, icon: Egg, label: t('flow.nav.eggs') },
    { to: `${base}/flow/medicine`, icon: Pill, label: t('flow.nav.medicine') },
    { to: `${base}/flow/feed`, icon: Wheat, label: t('flow.nav.feed') },
    { to: `${base}/flow/hisaab`, icon: Wallet, label: t('flow.nav.hisaab') },
  ];
  return (
    <Page farmId={farmId} screen="home">
      {(board) => (
        <>
          {board.setup.hasShed && (board.setup.hasBatch0 || board.setup.batch0Skipped) ? null : <SetupCard farmId={farmId} board={board} />}
          <section className="relative min-h-44 overflow-hidden rounded-[1.75rem] bg-[#E7F3E4] p-5">
            <p className="text-sm text-ink-soft">{t('flow.look.welcome')}</p>
            <p className="mt-2 font-display text-5xl font-semibold leading-none text-ink">{board.home.broodingCount + board.home.shedCount}</p>
            <p className="mt-1 text-sm text-ink-soft">{t('flow.look.flock')}</p>
            <span className="mt-3 inline-flex rounded-full bg-white px-3 py-1 text-xs font-semibold text-grove shadow-sm" title={t('flow.home.eggs')}>
              {t('flow.look.todayChip', { n: board.home.todayEggs })}
            </span>
            <img src="/art/barn-hero.jpg" alt="" className="pointer-events-none absolute bottom-0 right-0 h-36 w-40 object-cover object-left" />
          </section>
          <div className="grid grid-cols-4 gap-2">
            <TileStat stat="eggs" label={t('flow.home.eggs')} value={board.home.todayEggs} />
            <TileStat stat="brooding" label={t('flow.home.brooding')} value={board.home.broodingCount} />
            <TileStat stat="shed" label={t('flow.home.shed')} value={board.home.shedCount} />
            <TileStat stat="month" label={t('flow.home.month')} value={board.home.month.map((line) => `${line.difference} ${line.unit}`).join(', ')} />
          </div>
          <p className="text-xs text-ink-soft">{t('flow.home.monthHint')}</p>
          <div className="grid grid-cols-2 gap-2">
            <TileStat stat="medicine" label={t('flow.home.medicine')} value={board.home.todayMedicine.length} />
            <TileStat stat="feed" label={t('flow.home.feed')} value={board.home.todayFeed.length} />
          </div>
          <div>
            <h2 className="font-display text-xl font-semibold">{t('flow.look.quick')}</h2>
            <div className="mt-2 grid grid-cols-4 gap-2">
              {actions.map((action) => (
                <Link key={action.to} to={action.to} className="grid min-h-20 place-items-center rounded-2xl bg-white px-1 py-3 text-center text-[11px] font-semibold text-ink shadow-[0_8px_28px_rgba(31,77,43,0.06)]">
                  <action.icon aria-hidden="true" size={18} className="text-grove" />
                  {action.label}
                </Link>
              ))}
            </div>
          </div>
          <div className="grid gap-3">
            {board.batches.map((batch) => (
              <Card key={batch.id}>
                <h2 className="font-display text-2xl">{t('flow.home.batch', { n: batch.number })}</h2>
                <p className="mt-1 text-lg">
                  {t('flow.batch.brooding')} {batch.broodingLive} · {t('flow.batch.shedTab')} {batch.placements.reduce((sum, place) => sum + place.birdCount, 0)}
                </p>
              </Card>
            ))}
          </div>
        </>
      )}
    </Page>
  );
}

function SetupCard({ farmId, board }: { farmId: string; board: Board }) {
  const { t } = useTranslation();
  const { refresh } = useBoard(farmId);
  const save = useSave(farmId, refresh);
  const [shedName, setShedName] = useState('East shed');
  const [shedCap, setShedCap] = useState('40');
  const [birds, setBirds] = useState('10');
  const [shedId, setShedId] = useState(board.sheds[0]?.id ?? '');
  const [day, setDay] = useState(board.today);
  return (
    <Card className="grid gap-3 bg-gold">
      <h2 className="font-display text-2xl">{t('flow.home.setupTitle')}</h2>
      <p>{t('flow.home.setupBody')}</p>
      <p className="text-sm text-ink-soft">{t('flow.setup.seeded')}</p>
      {save.error ? <Alert>{save.error}</Alert> : null}
      <form
        className="grid gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          void save.run({ method: 'POST', path: '/flow/sheds', body: { name: shedName, capacity: Number(shedCap) } });
        }}
      >
        <Field id="setup-shed-name" label={t('flow.field.name')} hint={t('flow.hint.name')}>
          <Input id="setup-shed-name" value={shedName} placeholder={t('flow.ph.name')} onChange={(event) => setShedName(event.target.value)} />
        </Field>
        <Field id="setup-shed-cap" label={t('flow.field.capacity')} hint={t('flow.hint.capacity')}>
          <Input id="setup-shed-cap" type="number" value={shedCap} placeholder={t('flow.ph.capacity')} onChange={(event) => setShedCap(event.target.value)} />
        </Field>
        <Button type="submit" className="rounded-full" disabled={save.pending}>
          {t('flow.action.addShed')}
        </Button>
      </form>
      {board.setup.hasBatch0 || board.setup.batch0Skipped ? (
        <p>{board.setup.batch0Skipped ? t('flow.setup.skipped') : t('flow.setup.batch0')}</p>
      ) : (
        <form
          className="grid gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            void save.run({
              method: 'POST',
              path: '/flow/batches',
              body: { kind: 'existing', birdCount: Number(birds), shedId, placedOn: day, notes: '' },
            });
          }}
        >
          <h3 className="font-semibold">{t('flow.setup.batch0')}</h3>
          <Field id="batch0-count" label={t('flow.field.birds')} hint={t('flow.hint.birds')}>
            <Input id="batch0-count" type="number" value={birds} placeholder={t('flow.ph.birds')} onChange={(event) => setBirds(event.target.value)} />
          </Field>
          <Field id="batch0-shed" label={t('flow.field.shed')} hint={t('flow.hint.shed')}>
            <select id="batch0-shed" className={box} value={shedId} onChange={(event) => setShedId(event.target.value)}>
              <option value="">{t('flow.pick')}</option>
              {board.sheds.map((shed) => (
                <option key={shed.id} value={shed.id}>
                  {shed.name}
                </option>
              ))}
            </select>
          </Field>
          <Field id="batch0-date" label={t('flow.field.date')} hint={t('flow.hint.date')}>
            <Input id="batch0-date" type="date" value={day} onChange={(event) => setDay(event.target.value)} />
          </Field>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" className="rounded-full" disabled={save.pending}>
              {t('flow.action.save')}
            </Button>
            <Button type="button" variant="outline" className="rounded-full" onClick={() => void save.run({ method: 'POST', path: '/flow/setup/skip-batch0' })}>
              {t('flow.setup.skip')}
            </Button>
          </div>
        </form>
      )}
    </Card>
  );
}

export function FlowIncubatorPage() {
  const { farmId } = useParams();
  if (!farmId) return needFarm();
  return (
    <Page farmId={farmId} screen="incubator">
      {(board, save) => <IncubatorBody farmId={farmId} board={board} save={save} />}
    </Page>
  );
}

function IncubatorBody({ farmId, board, save }: { farmId: string; board: Board; save: ReturnType<typeof useSave> }) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [capacity, setCapacity] = useState('100');
  const [editId, setEditId] = useState<string | null>(null);
  const [incubatorId, setIncubatorId] = useState(board.incubators[0]?.id ?? '');
  const [eggs, setEggs] = useState('80');
  const [day, setDay] = useState(board.today);
  const [batchEdit, setBatchEdit] = useState<string | null>(null);
  const [tab, setTab] = useState('active');
  const [sheet, setSheet] = useState<'batch' | 'machine' | null>(null);
  const numbered = board.batches.filter((batch) => batch.number > 0);
  const active = numbered.filter((batch) => batch.hatchOn && batch.hatchOn >= board.today);
  const history = numbered.filter((batch) => batch.hatchOn && batch.hatchOn < board.today);
  const free = board.incubators.filter((item) => item.eggsInUse === 0);
  return (
    <>
      <PageHead title={t('flow.incubator.title')} subtitle={t('flow.incubator.lead')} />
      <Pills
        value={tab}
        onChange={setTab}
        options={[
          { id: 'active', label: t('flow.look.active') },
          { id: 'available', label: t('flow.look.available') },
          { id: 'history', label: t('flow.look.history') },
        ]}
      />
      {tab === 'active'
        ? active.length === 0
          ? <p className="text-sm text-ink-soft">{t('flow.incubator.empty')}</p>
          : active.map((batch) => {
              const machine = board.incubators.find((item) => item.id === batch.incubatorId);
              const dayNumber = daysSince(board.today, batch.setOn);
              return (
                <Card key={batch.id}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-grove">{t('flow.look.running')}</p>
                      <h2 className="font-display text-2xl">{machine?.name ?? t('flow.home.batch', { n: batch.number })}</h2>
                    </div>
                    {dayNumber ? <Chip tone="active">{t('flow.batch.day', { n: dayNumber })}</Chip> : null}
                  </div>
                  <p className="mt-3 text-sm text-ink-soft">{t('flow.field.eggsSet')}</p>
                  <p className="font-display text-4xl font-semibold text-ink">{batch.eggsSet}</p>
                  <p className="mt-2 text-sm text-ink-soft">
                    {t('flow.incubator.hatch')}: {batch.hatchOn}
                  </p>
                  <p className="text-sm text-ink-soft">{t('flow.home.batch', { n: batch.number })}</p>
                  {machine?.overCapacity ? <p className="mt-2 rounded-2xl bg-gold px-3 py-2 text-sm font-semibold">{t('flow.incubator.warn', { cap: machine.capacity })}</p> : null}
                  <Button asChild className="mt-3 w-full rounded-full">
                    <Link to={`/farms/${farmId}/flow/batch`}>{t('flow.look.openBatch')}</Link>
                  </Button>
                  <div className="mt-3">
                    <Actions
                      editId={`batch:${batch.id}`}
                      onEdit={() => {
                        setBatchEdit(batch.id);
                        setIncubatorId(batch.incubatorId ?? '');
                        setEggs(String(batch.eggsSet ?? ''));
                        setDay(batch.setOn ?? board.today);
                        setSheet('batch');
                      }}
                      onDelete={() => void save.run({ method: 'DELETE', path: `/flow/batches/${batch.id}` })}
                    />
                  </div>
                </Card>
              );
            })
        : null}
      {tab === 'available'
        ? free.length === 0
          ? <p className="text-sm text-ink-soft">{t('flow.look.noneFree')}</p>
          : free.map((item) => (
              <Card key={item.id}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm text-ink-soft">{t('flow.look.ready')}</p>
                    <h2 className="font-display text-2xl">{item.name}</h2>
                    <p className="text-sm text-ink-soft">{t('flow.field.capacity')} {item.capacity}</p>
                  </div>
                  <Chip tone="done">{t('flow.look.available')}</Chip>
                </div>
                <Button
                  type="button"
                  className="mt-3 w-full rounded-full"
                  onClick={() => {
                    setBatchEdit(null);
                    setIncubatorId(item.id);
                    setSheet('batch');
                  }}
                >
                  {t('flow.look.start')}
                </Button>
                <div className="mt-3">
                  <Actions
                    editId={`incubator:${item.id}`}
                    onEdit={() => {
                      setEditId(item.id);
                      setName(item.name);
                      setCapacity(String(item.capacity));
                      setSheet('machine');
                    }}
                    onDelete={() => void save.run({ method: 'DELETE', path: `/flow/incubators/${item.id}` })}
                  />
                </div>
              </Card>
            ))
        : null}
      {tab === 'history'
        ? history.length === 0
          ? <p className="text-sm text-ink-soft">{t('flow.incubator.empty')}</p>
          : history.map((batch) => (
              <Card key={batch.id}>
                <h2 className="font-display text-2xl">{t('flow.home.batch', { n: batch.number })}</h2>
                <p className="text-sm text-ink-soft">
                  {t('flow.field.eggsSet')} {batch.eggsSet} · {t('flow.incubator.hatch')}: {batch.hatchOn}
                </p>
                <div className="mt-3">
                  <Actions
                    editId={`batch:${batch.id}`}
                    onEdit={() => {
                      setBatchEdit(batch.id);
                      setIncubatorId(batch.incubatorId ?? '');
                      setEggs(String(batch.eggsSet ?? ''));
                      setDay(batch.setOn ?? board.today);
                      setSheet('batch');
                    }}
                    onDelete={() => void save.run({ method: 'DELETE', path: `/flow/batches/${batch.id}` })}
                  />
                </div>
              </Card>
            ))
        : null}
      {tab !== 'available' ? (
        <div className="grid gap-2">
          {board.incubators
            .filter((item) => item.eggsInUse > 0)
            .map((item) => (
              <Card key={item.id} className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-semibold">{item.name}</p>
                  <p className="text-sm text-ink-soft">{t('flow.incubator.inUse', { n: item.eggsInUse })}</p>
                  {item.overCapacity ? <p className="mt-2 rounded-2xl bg-gold px-3 py-2 text-sm font-semibold">{t('flow.incubator.warn', { cap: item.capacity })}</p> : null}
                </div>
                <Actions
                  editId={`incubator:${item.id}`}
                  onEdit={() => {
                    setEditId(item.id);
                    setName(item.name);
                    setCapacity(String(item.capacity));
                    setSheet('machine');
                  }}
                  onDelete={() => void save.run({ method: 'DELETE', path: `/flow/incubators/${item.id}` })}
                />
              </Card>
            ))}
        </div>
      ) : null}
      <button type="button" className="text-sm font-semibold text-grove" onClick={() => { setEditId(null); setName(''); setSheet('machine'); }}>
        {t('flow.action.addIncubator')}
      </button>
      <Sheet open={sheet === 'machine'} title={editId ? t('flow.action.edit') : t('flow.action.addIncubator')} closeLabel={t('flow.action.cancel')} onClose={() => setSheet(null)}>
        <form
          className="grid gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            const body = { name, capacity: Number(capacity) };
            void save.run(editId ? { method: 'PATCH', path: `/flow/incubators/${editId}`, body } : { method: 'POST', path: '/flow/incubators', body }).then(() => {
              setEditId(null);
              setName('');
              setSheet(null);
            });
          }}
        >
          <Field id="inc-name" label={t('flow.field.name')} hint={t('flow.hint.name')}>
            <Input id="inc-name" value={name} placeholder={t('flow.ph.name')} onChange={(event) => setName(event.target.value)} />
          </Field>
          <Field id="inc-cap" label={t('flow.field.capacity')} hint={t('flow.hint.capacity')}>
            <Input id="inc-cap" type="number" value={capacity} placeholder={t('flow.ph.capacity')} onChange={(event) => setCapacity(event.target.value)} />
          </Field>
          <Button type="submit" className="rounded-full" disabled={save.pending}>
            {editId ? t('flow.action.save') : t('flow.action.addIncubator')}
          </Button>
        </form>
      </Sheet>
      <Sheet open={sheet === 'batch'} title={batchEdit ? t('flow.action.edit') : t('flow.action.addBatch')} closeLabel={t('flow.action.cancel')} onClose={() => setSheet(null)}>
        <p className="mb-3 text-sm text-ink-soft">{t('flow.incubator.hatchNote')}</p>
        <form
          className="grid gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            const body = { kind: 'set', incubatorId, eggsSet: Number(eggs), setOn: day, notes: '' };
            void save
              .run(batchEdit ? { method: 'PATCH', path: `/flow/batches/${batchEdit}`, body } : { method: 'POST', path: '/flow/batches', body })
              .then(() => {
                setBatchEdit(null);
                setSheet(null);
              });
          }}
        >
          <Field id="incubator-pick" label={t('flow.field.incubator')} hint={t('flow.hint.incubator')}>
            <select id="incubator-pick" className={box} value={incubatorId} onChange={(event) => setIncubatorId(event.target.value)}>
              {board.incubators.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} ({item.capacity})
                </option>
              ))}
            </select>
          </Field>
          <Field id="eggs-set" label={t('flow.field.eggsSet')} hint={t('flow.hint.eggsSet')}>
            <Input id="eggs-set" type="number" value={eggs} placeholder={t('flow.ph.eggsSet')} onChange={(event) => setEggs(event.target.value)} />
          </Field>
          <Field id="set-date" label={t('flow.field.date')} hint={t('flow.hint.date')}>
            <Input id="set-date" type="date" value={day} onChange={(event) => setDay(event.target.value)} />
          </Field>
          <Button type="submit" className="rounded-full" data-add="batch" disabled={save.pending}>
            {batchEdit ? t('flow.action.save') : t('flow.action.addBatch')}
          </Button>
        </form>
      </Sheet>
      <Fab label={t('flow.action.addBatch')} onClick={() => { setBatchEdit(null); setSheet('batch'); }} />
    </>
  );
}

export function FlowBatchPage() {
  const { farmId } = useParams();
  const { t } = useTranslation();
  const [tab, setTab] = useState('brooding');
  if (!farmId) return needFarm();
  return (
    <Page farmId={farmId} screen="batch">
      {(board, save) => (
        <>
          <PageHead title={t('flow.nav.batch')} subtitle={t('flow.look.batchLead')} />
          <Pills
            value={tab}
            onChange={setTab}
            options={[
              { id: 'brooding', label: t('flow.batch.brooding') },
              { id: 'shed', label: t('flow.batch.shedTab') },
            ]}
          />
          {tab === 'brooding' ? <Brooding farmId={farmId} board={board} save={save} /> : <ShedTab board={board} save={save} />}
        </>
      )}
    </Page>
  );
}

function Brooding({ farmId, board, save }: { farmId: string; board: Board; save: ReturnType<typeof useSave> }) {
  const { t } = useTranslation();
  const flocks = board.batches.filter((batch) => batch.number > 0);
  const [batchId, setBatchId] = useState(flocks[0]?.id ?? '');
  const [dayNumber, setDayNumber] = useState('1');
  const [live, setLive] = useState('12');
  const [editDay, setEditDay] = useState<string | null>(null);
  const [deaths, setDeaths] = useState('1');
  const [moveCount, setMoveCount] = useState('4');
  const [shedId, setShedId] = useState(board.sheds[0]?.id ?? '');
  const [sheet, setSheet] = useState(false);
  const day = board.today;
  const batch = flocks.find((item) => item.id === batchId) ?? flocks[0];
  if (!batch) return <p>{t('flow.incubator.empty')}</p>;
  return (
    <div className="grid gap-3">
      <Field id="brood-batch" label={t('flow.field.batch')} hint={t('flow.hint.batch')}>
        <select id="brood-batch" className={box} value={batch.id} onChange={(event) => setBatchId(event.target.value)}>
          {flocks.map((item) => (
            <option key={item.id} value={item.id}>
              {t('flow.home.batch', { n: item.number })}
            </option>
          ))}
        </select>
      </Field>
      <Card className="overflow-hidden p-0">
        <div className="relative h-44">
          <img src="/art/chicks.jpg" alt="" className="h-full w-full object-cover" />
          <span className="absolute left-3 top-3">
            <Chip tone="active">{batch.ageDays ? t('flow.batch.day', { n: batch.ageDays }) : t('flow.batch.brooding')}</Chip>
          </span>
        </div>
        <div className="grid gap-1 p-4">
          <p className="text-sm text-ink-soft">{t('flow.home.batch', { n: batch.number })}</p>
          <p className="font-display text-5xl font-semibold leading-none text-ink">{batch.broodingLive}</p>
          <p className="text-lg">
            {t('flow.birds.brooding')}: {batch.broodingLive}
          </p>
          <p className="text-sm text-ink-soft">{t('flow.batch.running')}: {batch.liveTotal}</p>
          <p className="text-sm text-ink-soft">
            {t('flow.batch.bad')}: {batch.bad}
          </p>
          <p className="text-sm text-ink-soft">
            {t('flow.batch.ratio')}: {batch.ratio === null ? '—' : `${batch.ratio}%`}
          </p>
          <p className="text-sm text-ink-soft">{t('flow.batch.ratioNote')}</p>
          {batch.moveReminder ? <p className="mt-2 rounded-2xl bg-gold px-3 py-2 font-semibold">{t('flow.batch.remind')}</p> : null}
        </div>
      </Card>
      {batch.hatchDays.length === 0 ? <p className="text-sm text-ink-soft">{t('flow.batch.empty')}</p> : null}
      {batch.hatchDays.map((row) => (
        <Card key={row.id} className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Tile src="/art/chicks.jpg" tint="#FBF6E4" />
            <div>
              <p className="font-display text-2xl">{t('flow.batch.day', { n: row.dayNumber })}</p>
              <p className="text-sm text-ink-soft">
                {row.liveCount} · {t('flow.batch.running')} {row.runningTotal}
              </p>
            </div>
          </div>
          <Actions
            editId={`hatch:${row.id}`}
            onEdit={() => {
              setEditDay(row.id);
              setDayNumber(String(row.dayNumber));
              setLive(String(row.liveCount));
              setSheet(true);
            }}
            onDelete={() => void save.run({ method: 'DELETE', path: `/flow/hatch-days/${row.id}` })}
          />
        </Card>
      ))}
      <Sheet open={sheet} title={t('flow.batch.brooding')} closeLabel={t('flow.action.cancel')} onClose={() => setSheet(false)}>
        <form
          className="grid gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            const body = { dayNumber: Number(dayNumber), liveCount: Number(live) };
            void save
              .run(editDay ? { method: 'PATCH', path: `/flow/hatch-days/${editDay}`, body } : { method: 'POST', path: `/flow/batches/${batch.id}/hatch-days`, body })
              .then(() => {
                setEditDay(null);
                setSheet(false);
              });
          }}
        >
          <Field id="hatch-day" label={t('flow.field.day')} hint={t('flow.hint.day')}>
            <Input id="hatch-day" type="number" value={dayNumber} placeholder={t('flow.ph.day')} onChange={(event) => setDayNumber(event.target.value)} />
          </Field>
          <Field id="hatch-live" label={t('flow.field.live')} hint={t('flow.hint.live')}>
            <Input id="hatch-live" type="number" value={live} placeholder={t('flow.ph.live')} onChange={(event) => setLive(event.target.value)} />
          </Field>
          <Button type="submit" className="rounded-full" data-add="hatch" disabled={save.pending}>
            {editDay ? t('flow.action.save') : t('flow.action.add')}
          </Button>
        </form>
        <form
          className="mt-4 grid gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            void save.run({
              method: 'POST',
              path: '/flow/moves',
              body: { batchId: batch.id, kind: 'brooding_death', birdCount: Number(deaths), occurredOn: day, notes: '' },
            }).then(() => setSheet(false));
          }}
        >
          <Field id="death-count" label={t('flow.field.birds')} hint={t('flow.hint.birds')}>
            <Input id="death-count" type="number" value={deaths} placeholder={t('flow.ph.birds')} onChange={(event) => setDeaths(event.target.value)} />
          </Field>
          <Button type="submit" variant="clay" className="rounded-full" disabled={save.pending}>
            {t('flow.action.death')}
          </Button>
        </form>
        <form
          className="mt-4 grid gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            void save.run({
              method: 'POST',
              path: '/flow/moves',
              body: { batchId: batch.id, kind: 'to_shed', birdCount: Number(moveCount), occurredOn: day, shedId, notes: '' },
            }).then(() => setSheet(false));
          }}
        >
          <Field id="move-count" label={t('flow.field.birds')} hint={t('flow.hint.birds')}>
            <Input id="move-count" type="number" value={moveCount} placeholder={t('flow.ph.birds')} onChange={(event) => setMoveCount(event.target.value)} />
          </Field>
          <Field id="move-shed" label={t('flow.field.shed')} hint={t('flow.hint.shed')}>
            <select id="move-shed" className={box} value={shedId} onChange={(event) => setShedId(event.target.value)}>
              {board.sheds.map((shed) => (
                <option key={shed.id} value={shed.id}>
                  {shed.name}
                </option>
              ))}
            </select>
          </Field>
          <Button type="submit" className="rounded-full" data-add="to-shed" disabled={save.pending}>
            {t('flow.action.move')}
          </Button>
        </form>
      </Sheet>
      <Fab label={t('flow.action.add')} onClick={() => setSheet(true)} />
      <p className="sr-only">{farmId}</p>
    </div>
  );
}

function ShedTab({ board, save }: { board: Board; save: ReturnType<typeof useSave> }) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [capacity, setCapacity] = useState('40');
  const [editId, setEditId] = useState<string | null>(null);
  const [fromShed, setFromShed] = useState(board.sheds[0]?.id ?? '');
  const [toShed, setToShed] = useState(board.sheds[1]?.id ?? board.sheds[0]?.id ?? '');
  const [batchId, setBatchId] = useState(board.batches[0]?.id ?? '');
  const [count, setCount] = useState('2');
  const [sheet, setSheet] = useState(false);
  const placed = board.batches.find((batch) => batch.id === batchId);
  return (
    <div className="grid gap-3">
      {board.sheds.map((shed) => (
        <Card key={shed.id}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-display text-2xl">{shed.name}</h2>
              <p className="font-display text-5xl font-semibold text-ink">{shed.birdCount}</p>
              <p className="text-sm text-ink-soft">
                {shed.birdCount} / {shed.capacity}
              </p>
              {shed.overCapacity ? <p className="mt-2 rounded-2xl bg-gold px-3 py-2 text-sm font-semibold">{t('flow.batch.over', { cap: shed.capacity })}</p> : null}
              <ul className="mt-2">
                {board.batches
                  .flatMap((batch) => batch.placements.filter((place) => place.shedId === shed.id).map((place) => ({ batch, place })))
                  .map(({ batch, place }) => (
                    <li key={batch.id}>
                      {t('flow.home.batch', { n: batch.number })} · {t('flow.batch.inShed', { count: place.birdCount })}
                    </li>
                  ))}
              </ul>
            </div>
            <Actions
              editId={`shed:${shed.id}`}
              onEdit={() => {
                setEditId(shed.id);
                setName(shed.name);
                setCapacity(String(shed.capacity));
                setSheet(true);
              }}
              onDelete={() => void save.run({ method: 'DELETE', path: `/flow/sheds/${shed.id}` })}
            />
          </div>
        </Card>
      ))}
      <Sheet open={sheet} title={editId ? t('flow.action.edit') : t('flow.action.addShed')} closeLabel={t('flow.action.cancel')} onClose={() => setSheet(false)}>
        <form
          className="grid gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            const body = { name, capacity: Number(capacity) };
            void save.run(editId ? { method: 'PATCH', path: `/flow/sheds/${editId}`, body } : { method: 'POST', path: '/flow/sheds', body }).then(() => {
              setEditId(null);
              setName('');
              setSheet(false);
            });
          }}
        >
          <Field id="shed-name" label={t('flow.field.name')} hint={t('flow.hint.name')}>
            <Input id="shed-name" value={name} placeholder={t('flow.ph.name')} onChange={(event) => setName(event.target.value)} />
          </Field>
          <Field id="shed-cap" label={t('flow.field.capacity')} hint={t('flow.hint.capacity')}>
            <Input id="shed-cap" type="number" value={capacity} placeholder={t('flow.ph.capacity')} onChange={(event) => setCapacity(event.target.value)} />
          </Field>
          <Button type="submit" className="rounded-full" disabled={save.pending}>
            {editId ? t('flow.action.save') : t('flow.action.addShed')}
          </Button>
        </form>
        <form
          className="mt-4 grid gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            void save.run({
              method: 'POST',
              path: '/flow/moves',
              body: { batchId, kind: 'between_sheds', birdCount: Number(count), occurredOn: board.today, shedId: toShed, fromShedId: fromShed, notes: '' },
            }).then(() => setSheet(false));
          }}
        >
          <Field id="move-batch" label={t('flow.field.batch')} hint={t('flow.hint.batch')}>
            <select id="move-batch" className={box} value={batchId} onChange={(event) => setBatchId(event.target.value)}>
              {board.batches.map((batch) => (
                <option key={batch.id} value={batch.id}>
                  {t('flow.home.batch', { n: batch.number })}
                </option>
              ))}
            </select>
          </Field>
          <Field id="from-shed" label={t('flow.birds.pickShed')} hint={t('flow.hint.shed')}>
            <select id="from-shed" className={box} value={fromShed} onChange={(event) => setFromShed(event.target.value)}>
              {(placed?.placements.length ? placed.placements : board.sheds.map((shed) => ({ shedId: shed.id, shedName: shed.name }))).map((place) => (
                <option key={place.shedId} value={place.shedId}>
                  {place.shedName}
                </option>
              ))}
            </select>
          </Field>
          <Field id="to-shed" label={t('flow.field.shed')} hint={t('flow.hint.shed')}>
            <select id="to-shed" className={box} value={toShed} onChange={(event) => setToShed(event.target.value)}>
              {board.sheds.map((shed) => (
                <option key={shed.id} value={shed.id}>
                  {shed.name}
                </option>
              ))}
            </select>
          </Field>
          <Field id="shed-move-count" label={t('flow.field.birds')} hint={t('flow.hint.birds')}>
            <Input id="shed-move-count" type="number" value={count} placeholder={t('flow.ph.birds')} onChange={(event) => setCount(event.target.value)} />
          </Field>
          <Button type="submit" className="rounded-full" data-add="between" disabled={save.pending}>
            {t('flow.action.moveShed')}
          </Button>
        </form>
      </Sheet>
      <Fab label={t('flow.action.addShed')} onClick={() => setSheet(true)} />
    </div>
  );
}

function DoseCard({ line, batchId, day, save, index }: { line: DoseLine; batchId: string; day: string; save: ReturnType<typeof useSave>; index: number }) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [givenOn, setGivenOn] = useState(line.givenOn ?? day);
  return (
    <Card className="grid gap-2">
      <div className="flex items-start gap-3">
        <Tile src={bottles[index % bottles.length] ?? bottles[0]!} tint={tints[index % tints.length] ?? tints[0]!} />
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-xl leading-tight">{line.itemName}</h3>
          <p className="text-sm text-ink-soft">{t(`flow.med.${line.slot}`)}</p>
          <p className="text-sm text-ink-soft">
            {t('flow.med.how')}: {line.amountText}
          </p>
          {line.givenOn ? <p className="text-sm text-ink-soft">{t('flow.med.givenOn', { date: line.givenOn })}</p> : null}
        </div>
        <Chip tone={line.given ? 'done' : 'active'}>{line.given ? t('flow.look.completed') : t('flow.look.active')}</Chip>
      </div>
      {line.given && line.markId ? (
        <Actions editId={`dose:${line.markId}`} onEdit={() => setEditing(true)} onDelete={() => void save.run({ method: 'DELETE', path: `/flow/doses/${line.markId}` })} />
      ) : (
        <Button
          type="button"
          className="rounded-full"
          data-item={line.itemName}
          onClick={() => void save.run({ method: 'POST', path: '/flow/doses', body: { batchId, scheduleRowId: line.rowId, givenOn: day, notes: '' } })}
        >
          {t('flow.action.given')}
        </Button>
      )}
      {editing && line.markId ? (
        <form
          className="grid gap-3"
          data-sheet="dose-edit"
          onSubmit={(event) => {
            event.preventDefault();
            void save
              .run({ method: 'PATCH', path: `/flow/doses/${line.markId}`, body: { batchId, scheduleRowId: line.rowId, givenOn, notes: '' } })
              .then(() => setEditing(false));
          }}
        >
          <Field id={`dose-date-${line.markId}`} label={t('flow.field.date')} hint={t('flow.hint.date')}>
            <Input id={`dose-date-${line.markId}`} type="date" value={givenOn} onChange={(event) => setGivenOn(event.target.value)} />
          </Field>
          <Button type="submit" className="rounded-full">{t('flow.action.save')}</Button>
        </form>
      ) : null}
    </Card>
  );
}

export function FlowMedicinePage() {
  const { farmId } = useParams();
  if (!farmId) return needFarm();
  return (
    <Page farmId={farmId} screen="medicine">
      {(board, save) => <MedicineBody board={board} save={save} />}
    </Page>
  );
}

function MedicineBody({ board, save }: { board: Board; save: ReturnType<typeof useSave> }) {
  const { t } = useTranslation();
  const flocks = board.batches.filter((batch) => batch.hatchOn);
  const [batchId, setBatchId] = useState(flocks[0]?.id ?? '');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'done'>('all');
  const [filterOpen, setFilterOpen] = useState(false);
  const batch = flocks.find((item) => item.id === batchId) ?? flocks[0];
  const lines = batch ? [...batch.medicine.today, ...batch.medicine.next] : [];
  const shown = lines.filter((line) => {
    const needle = query.trim().toLowerCase();
    const matches = needle === '' || line.itemName.toLowerCase().includes(needle) || line.amountText.toLowerCase().includes(needle);
    if (!matches) return false;
    if (filter === 'active') return !line.given;
    if (filter === 'done') return line.given;
    return true;
  });
  return (
    <>
      <PageHead title={t('flow.med.title')} subtitle={t('flow.med.lead')} />
      <SearchRow id="med-search" value={query} onChange={setQuery} placeholder={t('flow.look.search')} filterLabel={t('flow.look.filter')} onFilter={() => setFilterOpen((open) => !open)} />
      {filterOpen ? (
        <div className="flex gap-2" data-filter="medicine">
          {(['all', 'active', 'done'] as const).map((item) => (
            <button key={item} type="button" className={`min-h-10 rounded-full px-4 text-sm font-semibold ${filter === item ? 'bg-grove text-white' : 'bg-white text-ink-soft'}`} onClick={() => setFilter(item)}>
              {t(item === 'all' ? 'flow.look.filterAll' : item === 'active' ? 'flow.look.active' : 'flow.look.completed')}
            </button>
          ))}
        </div>
      ) : null}
      <p className="text-sm text-ink-soft">{board.scheduleFound ? t('flow.med.source', { file: board.scheduleSource }) : t('flow.med.missing')}</p>
      <p className="text-sm text-ink-soft">{t('flow.med.season')}</p>
      {batch ? (
        <>
          <Field id="med-batch" label={t('flow.field.batch')} hint={t('flow.hint.batch')}>
            <select id="med-batch" className={box} value={batch.id} onChange={(event) => setBatchId(event.target.value)}>
              {flocks.map((item) => (
                <option key={item.id} value={item.id}>
                  {t('flow.home.batch', { n: item.number })}
                </option>
              ))}
            </select>
          </Field>
          <p className="font-semibold">{t('flow.med.age', { n: batch.medicine.ageDays ?? 0 })}</p>
          {shown.length === 0 ? <p className="text-sm text-ink-soft">{t('flow.med.none')}</p> : null}
          {shown.map((line, index) => (
            <DoseCard key={`${line.rowId}-${line.givenOn ?? 'due'}`} line={line} batchId={batch.id} day={board.today} save={save} index={index} />
          ))}
          <h2 className="font-display text-2xl">{t('flow.med.check')}</h2>
          {batch.medicine.vet.map((line) => (
            <Card key={line.rowId}>
              <h3 className="font-display text-2xl">{line.itemName}</h3>
              <p className="text-sm text-ink-soft">{line.amountText}</p>
            </Card>
          ))}
        </>
      ) : (
        <p>{t('flow.med.none')}</p>
      )}
      <Tip>{t('flow.look.tip')}</Tip>
      <p className="text-sm text-ink-soft">{t('flow.med.vaccines')}</p>
    </>
  );
}

export function FlowFeedPage() {
  const { farmId } = useParams();
  if (!farmId) return needFarm();
  return (
    <Page farmId={farmId} screen="feed">
      {(board, save) => <FeedBody board={board} save={save} />}
    </Page>
  );
}

function FeedBody({ board, save }: { board: Board; save: ReturnType<typeof useSave> }) {
  const { t } = useTranslation();
  const [batchId, setBatchId] = useState(board.batches[0]?.id ?? '');
  const [feedType, setFeedType] = useState('starter mash');
  const [qty, setQty] = useState('2.5');
  const [unit, setUnit] = useState('kg');
  const [day, setDay] = useState(board.today);
  const [editId, setEditId] = useState<string | null>(null);
  const [sheet, setSheet] = useState(false);
  return (
    <>
      <PageHead title={t('flow.feed.title')} subtitle={t('flow.feed.note')} />
      {board.feed.length === 0 ? <p className="text-sm text-ink-soft">{t('flow.feed.empty')}</p> : null}
      {board.feed.map((row) => (
        <Card key={row.id} className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Tile src="/art/hens.jpg" tint="#FBF6E4" />
            <div>
              <p className="font-display text-3xl font-semibold text-ink">
                {row.quantity} {row.unitLabel}
              </p>
              <p>
                {row.feedType} · {t('flow.home.batch', { n: row.batchNumber })}
              </p>
              <p className="text-sm text-ink-soft">
                {t('flow.feed.age', { n: row.ageDay ?? '—' })} · {t('flow.feed.season')}
              </p>
            </div>
          </div>
          <Actions
            editId={`feed:${row.id}`}
            onEdit={() => {
              setEditId(row.id);
              setBatchId(row.batchId);
              setFeedType(row.feedType);
              setQty(String(row.quantity));
              setUnit(row.unitLabel);
              setDay(row.occurredOn ?? board.today);
              setSheet(true);
            }}
            onDelete={() => void save.run({ method: 'DELETE', path: `/flow/feed/${row.id}` })}
          />
        </Card>
      ))}
      <Sheet open={sheet} title={editId ? t('flow.action.edit') : t('flow.feed.title')} closeLabel={t('flow.action.cancel')} onClose={() => setSheet(false)}>
        <form
          className="grid gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            const body = { batchId, occurredOn: day, feedType, quantity: Number(qty), unitLabel: unit, notes: '' };
            void save.run(editId ? { method: 'PATCH', path: `/flow/feed/${editId}`, body } : { method: 'POST', path: '/flow/feed', body }).then(() => {
              setEditId(null);
              setSheet(false);
            });
          }}
        >
          <Field id="feed-batch" label={t('flow.field.batch')} hint={t('flow.hint.batch')}>
            <select id="feed-batch" className={box} value={batchId} onChange={(event) => setBatchId(event.target.value)}>
              {board.batches.map((batch) => (
                <option key={batch.id} value={batch.id}>
                  {t('flow.home.batch', { n: batch.number })}
                </option>
              ))}
            </select>
          </Field>
          <Field id="feed-date" label={t('flow.field.date')} hint={t('flow.hint.date')}>
            <Input id="feed-date" type="date" value={day} onChange={(event) => setDay(event.target.value)} />
          </Field>
          <Field id="feed-type" label={t('flow.field.feedType')} hint={t('flow.hint.feedType')}>
            <Input id="feed-type" value={feedType} placeholder={t('flow.ph.feedType')} onChange={(event) => setFeedType(event.target.value)} />
          </Field>
          <Field id="feed-qty" label={t('flow.field.qty')} hint={t('flow.hint.qty')}>
            <Input id="feed-qty" type="number" value={qty} placeholder={t('flow.ph.qty')} onChange={(event) => setQty(event.target.value)} />
          </Field>
          <Field id="feed-unit" label={t('flow.field.unit')} hint={t('flow.hint.unit')}>
            <Input id="feed-unit" value={unit} placeholder={t('flow.ph.unit')} onChange={(event) => setUnit(event.target.value)} />
          </Field>
          <Button type="submit" className="rounded-full" data-add="feed" disabled={save.pending}>
            {editId ? t('flow.action.save') : t('flow.action.add')}
          </Button>
        </form>
      </Sheet>
      <Fab label={t('flow.action.add')} onClick={() => { setEditId(null); setSheet(true); }} />
    </>
  );
}

export function FlowEggsPage() {
  const { farmId } = useParams();
  if (!farmId) return needFarm();
  return (
    <Page farmId={farmId} screen="eggs">
      {(board, save) => <EggsBody board={board} save={save} />}
    </Page>
  );
}

function EggsBody({ board, save }: { board: Board; save: ReturnType<typeof useSave> }) {
  const { t } = useTranslation();
  const [day, setDay] = useState(board.today);
  const [collected, setCollected] = useState('24');
  const [sold, setSold] = useState('10');
  const [forInc, setForInc] = useState('6');
  const [editId, setEditId] = useState<string | null>(null);
  const [tab, setTab] = useState('overview');
  const [sheet, setSheet] = useState(false);
  const collectedSum = board.eggs.reduce((sum, row) => sum + row.collected, 0);
  const soldSum = board.eggs.reduce((sum, row) => sum + row.sold, 0);
  const incSum = board.eggs.reduce((sum, row) => sum + row.forIncubator, 0);
  const rows = tab === 'overview' ? board.eggs.slice(0, 3) : board.eggs;
  return (
    <>
      <PageHead title={t('flow.eggs.title')} subtitle={t('flow.eggs.stockNote')} />
      <Pills
        value={tab}
        onChange={setTab}
        options={[
          { id: 'overview', label: t('flow.look.overview') },
          { id: 'records', label: t('flow.look.records') },
          { id: 'summary', label: t('flow.look.summary') },
        ]}
      />
      {tab !== 'summary' ? (
        <Card className="bg-[#FBF6E4]">
          <p className="text-sm text-ink-soft">{t('flow.home.eggs')}</p>
          <div className="flex items-end justify-between gap-3">
            <p className="font-display text-5xl font-semibold leading-none">{board.home.todayEggs}</p>
            <img src="/art/egg-basket.jpg" alt="" className="h-20 w-24 rounded-2xl object-cover" />
          </div>
          <p className="mt-2 text-sm text-ink-soft">{t('flow.eggs.stock')}</p>
          <p className="font-display text-3xl font-semibold" data-value="stock">{board.eggStock}</p>
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <TileStat stat="collected" label={t('flow.field.collected')} value={collectedSum} />
          <TileStat stat="sold" label={t('flow.field.sold')} value={soldSum} />
          <TileStat stat="incubator" label={t('flow.field.forInc')} value={incSum} />
          <TileStat stat="stock" label={t('flow.eggs.stock')} value={board.eggStock} />
        </div>
      )}
      {tab !== 'summary' ? (
        <>
          <div className="flex items-center justify-between">
            <h2 className="font-display text-xl">{t('flow.look.recent')}</h2>
            {tab === 'overview' ? (
              <button type="button" className="text-sm font-semibold text-grove" onClick={() => setTab('records')}>
                {t('flow.look.viewAll')}
              </button>
            ) : null}
          </div>
          {board.eggs.length === 0 ? <p className="text-sm text-ink-soft">{t('flow.eggs.empty')}</p> : null}
          {rows.map((row) => (
            <Card key={row.id} className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Tile src="/art/egg-basket.jpg" tint="#FBF6E4" />
                <div>
                  <p className="font-semibold">{row.occurredOn}</p>
                  <p className="text-sm text-ink-soft">
                    {row.collected} / {row.sold} / {row.forIncubator}
                  </p>
                </div>
              </div>
              <Actions
                editId={`egg:${row.id}`}
                onEdit={() => {
                  setEditId(row.id);
                  setDay(row.occurredOn ?? board.today);
                  setCollected(String(row.collected));
                  setSold(String(row.sold));
                  setForInc(String(row.forIncubator));
                  setSheet(true);
                }}
                onDelete={() => void save.run({ method: 'DELETE', path: `/flow/eggs/${row.id}` })}
              />
            </Card>
          ))}
        </>
      ) : (
        <p className="text-sm text-ink-soft">{t('flow.eggs.stockNote')}</p>
      )}
      <Sheet open={sheet} title={editId ? t('flow.action.edit') : t('flow.eggs.title')} closeLabel={t('flow.action.cancel')} onClose={() => setSheet(false)}>
        <form
          className="grid gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            const body = { occurredOn: day, collected: Number(collected), sold: Number(sold), forIncubator: Number(forInc), notes: '' };
            void save.run(editId ? { method: 'PATCH', path: `/flow/eggs/${editId}`, body } : { method: 'POST', path: '/flow/eggs', body }).then(() => {
              setEditId(null);
              setSheet(false);
            });
          }}
        >
          <Field id="egg-date" label={t('flow.field.date')} hint={t('flow.hint.date')}>
            <Input id="egg-date" type="date" value={day} onChange={(event) => setDay(event.target.value)} />
          </Field>
          <Field id="egg-collected" label={t('flow.field.collected')} hint={t('flow.hint.collected')}>
            <Input id="egg-collected" type="number" value={collected} placeholder={t('flow.ph.collected')} onChange={(event) => setCollected(event.target.value)} />
          </Field>
          <Field id="egg-sold" label={t('flow.field.sold')} hint={t('flow.hint.sold')}>
            <Input id="egg-sold" type="number" value={sold} placeholder={t('flow.ph.sold')} onChange={(event) => setSold(event.target.value)} />
          </Field>
          <Field id="egg-incubator" label={t('flow.field.forInc')} hint={t('flow.hint.forInc')}>
            <Input id="egg-incubator" type="number" value={forInc} placeholder={t('flow.ph.forInc')} onChange={(event) => setForInc(event.target.value)} />
          </Field>
          <Button type="submit" className="rounded-full" data-add="eggs" disabled={save.pending}>
            {editId ? t('flow.action.save') : t('flow.action.add')}
          </Button>
        </form>
      </Sheet>
      <Fab label={t('flow.action.add')} onClick={() => { setEditId(null); setSheet(true); }} />
    </>
  );
}

export function FlowBirdsPage() {
  const { farmId } = useParams();
  if (!farmId) return needFarm();
  return (
    <Page farmId={farmId} screen="birds">
      {(board, save) => <BirdsBody board={board} save={save} />}
    </Page>
  );
}

function BirdsBody({ board, save }: { board: Board; save: ReturnType<typeof useSave> }) {
  const { t } = useTranslation();
  const total = board.home.broodingCount + board.home.shedCount;
  const [tab, setTab] = useState('all');
  const [batchId, setBatchId] = useState(board.batches.find((batch) => batch.placements.length)?.id ?? board.batches[0]?.id ?? '');
  const batch = board.batches.find((item) => item.id === batchId);
  const [shedId, setShedId] = useState(batch?.placements[0]?.shedId ?? '');
  const [reason, setReason] = useState<'died' | 'sold' | 'other'>('died');
  const [count, setCount] = useState('1');
  const [buyer, setBuyer] = useState('Raju');
  const [price, setPrice] = useState('200');
  const [sheet, setSheet] = useState(false);
  return (
    <>
      <PageHead title={t('flow.birds.title')} subtitle={t('flow.look.flockLead')} />
      <Pills
        value={tab}
        onChange={setTab}
        options={[
          { id: 'all', label: t('flow.look.allBirds') },
          { id: 'batch', label: t('flow.look.byBatch') },
          { id: 'health', label: t('flow.look.health') },
        ]}
      />
      {tab === 'all' ? (
        <Card>
          <div className="flex items-center gap-3">
            <img src="/art/hens.jpg" alt="" className="h-16 w-20 rounded-2xl object-cover" />
            <div>
              <p className="text-sm text-ink-soft">{t('flow.birds.total')}</p>
              <p className="font-display text-5xl font-semibold leading-none">{total}</p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 border-t border-line pt-3">
            <div>
              <p className="text-sm text-ink-soft">{t('flow.home.brooding')}</p>
              <p className="font-display text-3xl font-semibold">{board.home.broodingCount}</p>
            </div>
            <div>
              <p className="text-sm text-ink-soft">{t('flow.home.shed')}</p>
              <p className="font-display text-3xl font-semibold">{board.home.shedCount}</p>
            </div>
          </div>
          {board.batches.flatMap((item) => item.placements.map((place) => (
            <p key={`${item.id}-${place.shedId}`} className="mt-2 text-sm">
              {place.shedName}: {place.birdCount}
            </p>
          )))}
        </Card>
      ) : null}
      {tab === 'batch'
        ? board.batches.map((item) => {
            const shedBirds = item.placements.reduce((sum, place) => sum + place.birdCount, 0);
            return (
              <Card key={item.id} className="flex items-center gap-3">
                <Tile src={item.broodingLive > 0 ? '/art/chicks.jpg' : '/art/hens.jpg'} tint={item.broodingLive > 0 ? '#FFF1DE' : '#E8F6EA'} />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{t('flow.home.batch', { n: item.number })}</p>
                  <p className="text-sm text-ink-soft">
                    {t('flow.birds.brooding')}: {item.broodingLive}
                  </p>
                  {item.placements.map((place) => (
                    <p key={place.shedId} className="text-sm text-ink-soft">
                      {place.shedName}: {place.birdCount}
                    </p>
                  ))}
                </div>
                <div className="grid justify-items-end gap-1">
                  <p className="font-display text-2xl font-semibold">{item.broodingLive + shedBirds}</p>
                  {item.broodingLive > 0 ? <Chip tone="grow">{t('flow.look.growing')}</Chip> : null}
                  {shedBirds > 0 ? <Chip tone="shed">{t('flow.look.inShed')}</Chip> : null}
                </div>
              </Card>
            );
          })
        : null}
      {tab === 'health' ? (
        <>
          <p className="text-sm text-ink-soft">{t('flow.look.healthNote')}</p>
          {board.batches.map((item) => (
            <Card key={item.id}>
              <h2 className="font-display text-xl">{t('flow.home.batch', { n: item.number })}</h2>
              {item.medicine.today.length === 0 ? <p className="text-sm text-ink-soft">{t('flow.med.none')}</p> : null}
              {item.medicine.today.map((line) => (
                <p key={line.rowId} className="mt-1 text-sm">
                  {line.itemName} · {line.given ? t('flow.look.completed') : t('flow.look.active')}
                </p>
              ))}
            </Card>
          ))}
        </>
      ) : null}
      <Sheet open={sheet} title={t('flow.birds.title')} closeLabel={t('flow.action.cancel')} onClose={() => setSheet(false)}>
        <form
          className="grid gap-3"
          onSubmit={(event: FormEvent) => {
            event.preventDefault();
            void save.run({
              method: 'POST',
              path: '/flow/moves',
              body: {
                batchId,
                kind: 'exit',
                birdCount: Number(count),
                occurredOn: board.today,
                shedId,
                reason,
                buyer: reason === 'sold' ? buyer : '',
                quantity: reason === 'sold' ? Number(count) : undefined,
                price: reason === 'sold' ? Number(price) : undefined,
                unitLabel: 'Rs',
                notes: '',
              },
            }).then(() => setSheet(false));
          }}
        >
          <Field id="bird-batch" label={t('flow.field.batch')} hint={t('flow.hint.batch')}>
            <select
              id="bird-batch"
              className={box}
              value={batchId}
              onChange={(event) => {
                setBatchId(event.target.value);
                const next = board.batches.find((item) => item.id === event.target.value);
                setShedId(next?.placements[0]?.shedId ?? '');
              }}
            >
              {board.batches.map((item) => (
                <option key={item.id} value={item.id}>
                  {t('flow.home.batch', { n: item.number })}
                </option>
              ))}
            </select>
          </Field>
          <Field id="bird-shed" label={t('flow.birds.pickShed')} hint={t('flow.hint.shed')}>
            <select id="bird-shed" className={box} value={shedId} onChange={(event) => setShedId(event.target.value)}>
              {(batch?.placements ?? []).map((place) => (
                <option key={place.shedId} value={place.shedId}>
                  {place.shedName} ({place.birdCount})
                </option>
              ))}
            </select>
          </Field>
          <Field id="bird-reason" label={t('flow.field.reason')} hint={t('flow.hint.reason')}>
            <select id="bird-reason" className={box} value={reason} onChange={(event) => setReason(event.target.value as 'died' | 'sold' | 'other')}>
              <option value="died">{t('flow.birds.died')}</option>
              <option value="sold">{t('flow.birds.sold')}</option>
              <option value="other">{t('flow.birds.other')}</option>
            </select>
          </Field>
          <Field id="bird-count" label={t('flow.field.birds')} hint={t('flow.hint.birds')}>
            <Input id="bird-count" type="number" value={count} placeholder={t('flow.ph.birds')} onChange={(event) => setCount(event.target.value)} />
          </Field>
          {reason === 'sold' ? (
            <>
              <Field id="bird-buyer" label={t('flow.field.buyer')} hint={t('flow.hint.buyer')}>
                <Input id="bird-buyer" value={buyer} placeholder={t('flow.ph.buyer')} onChange={(event) => setBuyer(event.target.value)} />
              </Field>
              <Field id="bird-price" label={t('flow.field.price')} hint={t('flow.hint.price')}>
                <Input id="bird-price" type="number" value={price} placeholder={t('flow.ph.price')} onChange={(event) => setPrice(event.target.value)} />
              </Field>
            </>
          ) : null}
          <Button type="submit" className="rounded-full" data-add="birds" disabled={save.pending}>
            {t('flow.action.save')}
          </Button>
        </form>
        {batch && batch.placements.length === 0 ? <p className="mt-2 text-sm text-ink-soft">{t('flow.birds.empty')}</p> : null}
      </Sheet>
      <Fab label={t('flow.action.add')} onClick={() => setSheet(true)} />
    </>
  );
}

export function FlowHisaabPage() {
  const { farmId } = useParams();
  if (!farmId) return needFarm();
  return (
    <Page farmId={farmId} screen="hisaab">
      {(board, save) => <HisaabBody board={board} save={save} />}
    </Page>
  );
}

function HisaabBody({ board, save }: { board: Board; save: ReturnType<typeof useSave> }) {
  const { t } = useTranslation();
  const [day, setDay] = useState(board.today);
  const [category, setCategory] = useState<'feed' | 'medicine' | 'electricity' | 'other'>('feed');
  const [amount, setAmount] = useState('250');
  const [expenseEdit, setExpenseEdit] = useState<string | null>(null);
  const [kind, setKind] = useState<'eggs' | 'birds'>('eggs');
  const [qty, setQty] = useState('10');
  const [price, setPrice] = useState('8');
  const [buyer, setBuyer] = useState('Raju');
  const [saleEdit, setSaleEdit] = useState<string | null>(null);
  const [sheet, setSheet] = useState(false);
  return (
    <>
      <PageHead title={t('flow.hisaab.title')} subtitle={t('flow.hisaab.basis')} />
      {board.home.month.map((line) => (
        <Card key={line.unit}>
          <p className="text-sm text-ink-soft">{t('flow.hisaab.diff')}</p>
          <p className="font-display text-4xl font-semibold">{line.difference} {line.unit}</p>
          <p className="mt-2 text-sm text-ink-soft">
            {t('flow.hisaab.salesIn')} {line.sales} {line.unit} · {t('flow.hisaab.spent')} {line.expenses} {line.unit}
          </p>
        </Card>
      ))}
      <h2 className="font-display text-xl">{t('flow.hisaab.expense')}</h2>
      {board.expenses.map((row) => (
        <Card key={row.id} className="flex items-center justify-between gap-3">
          <p>
            {t(`flow.hisaab.${row.category}`)} · {row.amount} {row.unitLabel}
          </p>
          <Actions
            editId={`expense:${row.id}`}
            onEdit={() => {
              setExpenseEdit(row.id);
              setCategory(row.category);
              setAmount(String(row.amount));
              setDay(row.occurredOn ?? board.today);
              setSheet(true);
            }}
            onDelete={() => void save.run({ method: 'DELETE', path: `/flow/expenses/${row.id}` })}
          />
        </Card>
      ))}
      <h2 className="font-display text-xl">{t('flow.hisaab.sale')}</h2>
      {board.sales.length === 0 && board.expenses.length === 0 ? <p className="text-sm text-ink-soft">{t('flow.hisaab.empty')}</p> : null}
      {board.sales.map((row) => (
        <Card key={row.id} className="flex items-center justify-between gap-3">
          <p>
            {t(`flow.hisaab.${row.kind}`)} · {row.quantity} × {row.price} = {row.amount} {row.unitLabel} · {row.buyer}
          </p>
          <Actions
            editId={`sale:${row.id}`}
            onEdit={() => {
              setSaleEdit(row.id);
              setKind(row.kind);
              setQty(String(row.quantity));
              setPrice(String(row.price));
              setBuyer(row.buyer);
              setDay(row.occurredOn ?? board.today);
              setSheet(true);
            }}
            onDelete={() => void save.run({ method: 'DELETE', path: `/flow/sales/${row.id}` })}
          />
        </Card>
      ))}
      <Sheet open={sheet} title={t('flow.hisaab.title')} closeLabel={t('flow.action.cancel')} onClose={() => setSheet(false)}>
        <form
          className="grid gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            const body = { occurredOn: day, category, amount: Number(amount), unitLabel: 'Rs', notes: '' };
            void save
              .run(expenseEdit ? { method: 'PATCH', path: `/flow/expenses/${expenseEdit}`, body } : { method: 'POST', path: '/flow/expenses', body })
              .then(() => {
                setExpenseEdit(null);
                setSheet(false);
              });
          }}
        >
          <h3 className="font-semibold">{t('flow.hisaab.expense')}</h3>
          <Field id="expense-date" label={t('flow.field.date')} hint={t('flow.hint.date')}>
            <Input id="expense-date" type="date" value={day} onChange={(event) => setDay(event.target.value)} />
          </Field>
          <Field id="expense-category" label={t('flow.field.category')} hint={t('flow.hint.category')}>
            <select id="expense-category" className={box} value={category} onChange={(event) => setCategory(event.target.value as typeof category)}>
              <option value="feed">{t('flow.hisaab.feed')}</option>
              <option value="medicine">{t('flow.hisaab.medicine')}</option>
              <option value="electricity">{t('flow.hisaab.electricity')}</option>
              <option value="other">{t('flow.hisaab.other')}</option>
            </select>
          </Field>
          <Field id="expense-amount" label={t('flow.field.amount')} hint={t('flow.hint.amount')}>
            <Input id="expense-amount" type="number" value={amount} placeholder={t('flow.ph.amount')} onChange={(event) => setAmount(event.target.value)} />
          </Field>
          <Button type="submit" className="rounded-full" data-add="expense" disabled={save.pending}>
            {expenseEdit ? t('flow.action.save') : t('flow.action.add')}
          </Button>
        </form>
        <form
          className="mt-4 grid gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            const body = { occurredOn: day, kind, quantity: Number(qty), price: Number(price), buyer, unitLabel: 'Rs', notes: '' };
            void save.run(saleEdit ? { method: 'PATCH', path: `/flow/sales/${saleEdit}`, body } : { method: 'POST', path: '/flow/sales', body }).then(() => {
              setSaleEdit(null);
              setSheet(false);
            });
          }}
        >
          <h3 className="font-semibold">{t('flow.hisaab.sale')}</h3>
          <Field id="sale-kind" label={t('flow.field.saleKind')} hint={t('flow.hint.saleKind')}>
            <select id="sale-kind" className={box} value={kind} onChange={(event) => setKind(event.target.value as 'eggs' | 'birds')}>
              <option value="eggs">{t('flow.hisaab.eggs')}</option>
              <option value="birds">{t('flow.hisaab.birds')}</option>
            </select>
          </Field>
          <Field id="sale-qty" label={t('flow.field.qty')} hint={t('flow.hint.qty')}>
            <Input id="sale-qty" type="number" value={qty} placeholder={t('flow.ph.qty')} onChange={(event) => setQty(event.target.value)} />
          </Field>
          <Field id="sale-price" label={t('flow.field.price')} hint={t('flow.hint.price')}>
            <Input id="sale-price" type="number" value={price} placeholder={t('flow.ph.price')} onChange={(event) => setPrice(event.target.value)} />
          </Field>
          <Field id="sale-buyer" label={t('flow.field.buyer')} hint={t('flow.hint.buyer')}>
            <Input id="sale-buyer" value={buyer} placeholder={t('flow.ph.buyer')} onChange={(event) => setBuyer(event.target.value)} />
          </Field>
          <Button type="submit" className="rounded-full" data-add="sale" disabled={save.pending}>
            {saleEdit ? t('flow.action.save') : t('flow.action.add')}
          </Button>
        </form>
      </Sheet>
      <Fab label={t('flow.action.add')} onClick={() => { setExpenseEdit(null); setSaleEdit(null); setSheet(true); }} />
    </>
  );
}

export const flowNav: { id: string; path: string; icon: LucideIcon; end?: boolean }[] = [
  { id: 'home', path: '', icon: Home, end: true },
  { id: 'incubator', path: 'flow/incubator', icon: Thermometer },
  { id: 'batch', path: 'flow/batch', icon: Bird },
  { id: 'medicine', path: 'flow/medicine', icon: Pill },
  { id: 'feed', path: 'flow/feed', icon: Wheat },
  { id: 'eggs', path: 'flow/eggs', icon: Egg },
  { id: 'birds', path: 'flow/birds', icon: Bird },
  { id: 'hisaab', path: 'flow/hisaab', icon: Wallet },
];
