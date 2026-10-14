import { birdEventInputSchema, eggLotInputSchema, trayHatchInputSchema, trayInputSchema, traySetInputSchema } from '@gavran/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import { Alert, Button, Card, Field, Input, TextArea } from '@/components/ui';
import { ApiError, api, errorKey } from '@/lib/api';
import type { Shed } from '@/lib/types';
import { localToday } from '@/lib/today';

type Lot = { id: string; sourceName: string; receivedOn: string; eggCount: number; notes: string | null };
type Tray = { id: string; incubatorId: string; incubatorCode: string; name: string };
type HatchDay = { id: string; hatchedOn: string; liveCount: number; batchId: string | null; batchCode: string | null };
type TraySet = { id: string; trayId: string; lotId: string | null; setOn: string; eggCount: number; status: string; live: number; bad: number; ratio: number | null; days: HatchDay[] };
type BirdEvent = { id: string; occurredOn: string; kind: 'died' | 'sold' | 'eaten'; birdCount: number; amount: number | null; unitLabel: string | null; notes: string | null; batchCode: string | null };
type Desi = { lots: Lot[]; trays: Tray[]; sets: TraySet[]; events: BirdEvent[] };
type Incubator = { id: string; code: string; name: string | null };
type Batch = { id: string; code: string; status: string };

function explain(error: unknown, t: (key: string) => string) {
  if (error instanceof ApiError) {
    const key = errorKey(error);
    if (key) return t(key);
    if (error.message) return error.message;
  }
  return t('common.errorGeneric');
}

function useDesi(farmId: string) {
  return useQuery({ queryKey: ['desi', farmId], queryFn: () => api<Desi>(`/api/v1/farms/${farmId}/desi`) });
}

export function EggLotsPage() {
  const { farmId = '' } = useParams();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const desi = useDesi(farmId);
  const [sourceName, setSourceName] = useState('');
  const [receivedOn, setReceivedOn] = useState(localToday());
  const [eggCount, setEggCount] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: (body: unknown) => api(`/api/v1/farms/${farmId}/egg-lots`, { method: 'POST', json: body }),
    onSuccess: async () => {
      setSourceName('');
      setEggCount('');
      setNotes('');
      await queryClient.invalidateQueries({ queryKey: ['desi', farmId] });
    },
  });
  function submit(event: FormEvent) {
    event.preventDefault();
    const parsed = eggLotInputSchema.safeParse({ sourceName, receivedOn, eggCount: Number(eggCount), notes });
    if (!parsed.success) {
      setError(t('validation.invalid'));
      return;
    }
    setError(null);
    save.mutate(parsed.data);
  }
  if (desi.isLoading) return <p>{t('common.loading')}</p>;
  if (desi.isError || !desi.data) return <Alert>{explain(desi.error, t)}</Alert>;
  return (
    <div className="grid gap-4">
      <h1 className="font-display text-3xl font-semibold">{t('desi.lotsTitle')}</h1>
      <p className="text-ink-soft">{t('desi.lotsBody')}</p>
      <Card>
        <form className="grid gap-3" onSubmit={submit}>
          <Field id="lot-source" label={t('desi.source')} hint={t('desi.sourceHint')}>
            <Input id="lot-source" value={sourceName} placeholder={t('desi.sourcePh')} onChange={(event) => setSourceName(event.target.value)} />
          </Field>
          <Field id="lot-date" label={t('desi.received')}>
            <Input id="lot-date" type="date" value={receivedOn} onChange={(event) => setReceivedOn(event.target.value)} />
          </Field>
          <Field id="lot-count" label={t('desi.eggCount')} hint={t('desi.eggCountHint')}>
            <Input id="lot-count" inputMode="numeric" value={eggCount} placeholder="120" onChange={(event) => setEggCount(event.target.value)} />
          </Field>
          <Field id="lot-notes" label={t('eggs.notes')}>
            <TextArea id="lot-notes" value={notes} placeholder={t('desi.notesPh')} onChange={(event) => setNotes(event.target.value)} />
          </Field>
          {error ? <Alert>{error}</Alert> : null}
          {save.isError ? <Alert>{explain(save.error, t)}</Alert> : null}
          <Button type="submit" disabled={save.isPending || sourceName.trim().length < 2 || Number(eggCount) < 1}>{t('desi.addLot')}</Button>
          {sourceName.trim().length < 2 || Number(eggCount) < 1 ? <p className="text-sm">{t('desi.lotWhy')}</p> : null}
        </form>
      </Card>
      {desi.data.lots.length === 0 ? <Card><p>{t('desi.lotsEmpty')}</p></Card> : desi.data.lots.map((lot) => (
        <Card key={lot.id}>
          <p className="font-semibold">{lot.sourceName}</p>
          <p className="text-sm">{lot.receivedOn} · {lot.eggCount}</p>
          {lot.notes ? <p className="text-sm">{lot.notes}</p> : null}
        </Card>
      ))}
    </div>
  );
}

export function TraysPage() {
  const { farmId = '' } = useParams();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const desi = useDesi(farmId);
  const machines = useQuery({ queryKey: ['incubators', farmId], queryFn: () => api<Incubator[]>(`/api/v1/farms/${farmId}/incubators`) });
  const sheds = useQuery({ queryKey: ['sheds', farmId], queryFn: () => api<Shed[]>(`/api/v1/farms/${farmId}/sheds`) });
  const [incubatorId, setIncubatorId] = useState('');
  const [trayName, setTrayName] = useState('');
  const [trayId, setTrayId] = useState('');
  const [lotId, setLotId] = useState('');
  const [setOn, setSetOn] = useState(localToday());
  const [eggCount, setEggCount] = useState('');
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['desi', farmId] });
  const addTray = useMutation({
    mutationFn: () => api(`/api/v1/farms/${farmId}/trays`, { method: 'POST', json: trayInputSchema.parse({ incubatorId, name: trayName }) }),
    onSuccess: () => { setTrayName(''); void refresh(); },
  });
  const addSet = useMutation({
    mutationFn: () => api(`/api/v1/farms/${farmId}/tray-sets`, { method: 'POST', json: traySetInputSchema.parse({ trayId, lotId, setOn, eggCount: Number(eggCount) }) }),
    onSuccess: () => { setEggCount(''); void refresh(); },
  });
  if (desi.isLoading) return <p>{t('common.loading')}</p>;
  if (desi.isError || !desi.data) return <Alert>{explain(desi.error, t)}</Alert>;
  return (
    <div className="grid gap-4">
      <h1 className="font-display text-3xl font-semibold">{t('desi.traysTitle')}</h1>
      <p className="text-ink-soft">{t('desi.traysBody')}</p>
      <Card>
        <form className="grid gap-3" onSubmit={(event) => { event.preventDefault(); addTray.mutate(); }}>
          <Field id="tray-machine" label={t('desi.machine')} hint={t('desi.machineHint')}>
            <select id="tray-machine" className="min-h-11 w-full rounded-xl border border-line bg-white px-3" value={incubatorId} onChange={(event) => setIncubatorId(event.target.value)}>
              <option value="">{t('desi.pickMachine')}</option>
              {(machines.data ?? []).map((machine) => <option key={machine.id} value={machine.id}>{machine.code}</option>)}
            </select>
          </Field>
          <Field id="tray-name" label={t('desi.trayName')} hint={t('desi.trayHint')}>
            <Input id="tray-name" value={trayName} placeholder="1" onChange={(event) => setTrayName(event.target.value)} />
          </Field>
          {!incubatorId ? <p className="text-sm">{t('desi.pickMachine')}</p> : null}
          {addTray.isError ? <Alert>{explain(addTray.error, t)}</Alert> : null}
          <Button type="submit" disabled={addTray.isPending || !incubatorId || trayName.trim().length < 1}>{t('desi.addTray')}</Button>
        </form>
      </Card>
      <Card>
        <form className="grid gap-3" onSubmit={(event) => { event.preventDefault(); addSet.mutate(); }}>
          <Field id="set-tray" label={t('desi.trayName')}>
            <select id="set-tray" className="min-h-11 w-full rounded-xl border border-line bg-white px-3" value={trayId} onChange={(event) => setTrayId(event.target.value)}>
              <option value="">{t('desi.pickTray')}</option>
              {desi.data.trays.map((tray) => <option key={tray.id} value={tray.id}>{tray.incubatorCode} · {tray.name}</option>)}
            </select>
          </Field>
          <Field id="set-lot" label={t('desi.lotOptional')}>
            <select id="set-lot" className="min-h-11 w-full rounded-xl border border-line bg-white px-3" value={lotId} onChange={(event) => setLotId(event.target.value)}>
              <option value="">{t('desi.noLot')}</option>
              {desi.data.lots.map((lot) => <option key={lot.id} value={lot.id}>{lot.sourceName}</option>)}
            </select>
          </Field>
          <Field id="set-date" label={t('batches.eggSetOn')}>
            <Input id="set-date" type="date" value={setOn} onChange={(event) => setSetOn(event.target.value)} />
          </Field>
          <Field id="set-count" label={t('desi.eggCount')} hint={t('desi.eggCountHint')}>
            <Input id="set-count" inputMode="numeric" value={eggCount} placeholder="90" onChange={(event) => setEggCount(event.target.value)} />
          </Field>
          {addSet.isError ? <Alert>{explain(addSet.error, t)}</Alert> : null}
          <Button type="submit" disabled={addSet.isPending || !trayId || Number(eggCount) < 1}>{t('desi.addSet')}</Button>
        </form>
      </Card>
      {desi.data.sets.map((row) => (
        <HatchCard key={row.id} farmId={farmId} row={row} sheds={sheds.data ?? []} trayName={desi.data.trays.find((tray) => tray.id === row.trayId)?.name ?? ''} />
      ))}
    </div>
  );
}

function HatchCard({ farmId, row, sheds, trayName }: { farmId: string; row: TraySet; sheds: Shed[]; trayName: string }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [hatchedOn, setHatchedOn] = useState(localToday());
  const [liveCount, setLiveCount] = useState('');
  const [shedId, setShedId] = useState(sheds[0]?.id ?? '');
  const [batchCode, setBatchCode] = useState('');
  useEffect(() => {
    if (!shedId && sheds[0]) setShedId(sheds[0].id);
  }, [shedId, sheds]);
  const save = useMutation({
    mutationFn: () => api(`/api/v1/farms/${farmId}/tray-sets/${row.id}/hatches`, {
      method: 'POST',
      json: trayHatchInputSchema.parse({ hatchedOn, liveCount: Number(liveCount), shedId, batchCode }),
    }),
    onSuccess: async () => {
      setLiveCount('');
      setBatchCode('');
      await queryClient.invalidateQueries({ queryKey: ['desi', farmId] });
    },
  });
  return (
    <Card>
      <p className="font-semibold">{t('desi.setLine', { tray: trayName, count: row.eggCount, date: row.setOn ?? '' })}</p>
      <p className="text-sm">{t('desi.hatchMath', { live: row.live, bad: row.bad, ratio: row.ratio === null ? t('dash.notSet') : String(row.ratio) })}</p>
      <p className="text-sm text-ink-soft">{t('desi.ratioNote')}</p>
      <ul className="mt-2 grid gap-1 text-sm">
        {row.days.map((day) => (
          <li key={day.id}>{day.hatchedOn} · {day.liveCount}{day.batchCode ? ` · ${day.batchCode}` : ''}</li>
        ))}
      </ul>
      <ul className="mt-2 grid gap-1 text-sm">
        <li>{t('desi.checkHours')}</li>
        <li>{t('desi.checkGuard')}</li>
        <li>{t('desi.checkWater')}</li>
        <li>{t('desi.checkPaper')}</li>
      </ul>
      <form className="mt-3 grid gap-3" onSubmit={(event) => { event.preventDefault(); save.mutate(); }}>
        <Field id={`hatch-date-${row.id}`} label={t('desi.hatchDay')}>
          <Input id={`hatch-date-${row.id}`} type="date" value={hatchedOn} onChange={(event) => setHatchedOn(event.target.value)} />
        </Field>
        <Field id={`hatch-live-${row.id}`} label={t('desi.live')} hint={t('desi.liveHint')}>
          <Input id={`hatch-live-${row.id}`} inputMode="numeric" value={liveCount} placeholder="40" onChange={(event) => setLiveCount(event.target.value)} />
        </Field>
        <Field id={`hatch-shed-${row.id}`} label={t('desi.brooderShed')}>
          <select id={`hatch-shed-${row.id}`} className="min-h-11 w-full rounded-xl border border-line bg-white px-3" value={shedId} onChange={(event) => setShedId(event.target.value)}>
            {sheds.length === 0 ? <option value="">{t('batches.noShed')}</option> : null}
            {sheds.map((shed) => <option key={shed.id} value={shed.id}>{shed.code} · {shed.name}</option>)}
          </select>
        </Field>
        {sheds.length === 0 ? <p className="text-sm font-semibold">{t('batches.needShed')}</p> : null}
        <Field id={`hatch-code-${row.id}`} label={t('batches.code')} hint={t('desi.codeHint')}>
          <Input id={`hatch-code-${row.id}`} value={batchCode} placeholder="C1" onChange={(event) => setBatchCode(event.target.value)} />
        </Field>
        {save.isError ? <Alert>{explain(save.error, t)}</Alert> : null}
        <Button type="submit" disabled={save.isPending || liveCount === '' || !shedId || batchCode.trim().length < 1}>{t('desi.addHatch')}</Button>
      </form>
    </Card>
  );
}

export function BirdsBookPage() {
  const { farmId = '' } = useParams();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const desi = useDesi(farmId);
  const batches = useQuery({ queryKey: ['batches', farmId], queryFn: () => api<Batch[]>(`/api/v1/farms/${farmId}/batches`) });
  const [kind, setKind] = useState<'died' | 'sold' | 'eaten'>('died');
  const [occurredOn, setOccurredOn] = useState(localToday());
  const [birdCount, setBirdCount] = useState('');
  const [amount, setAmount] = useState('');
  const [unitLabel, setUnitLabel] = useState('Rs');
  const [batchId, setBatchId] = useState('');
  const [notes, setNotes] = useState('');
  const save = useMutation({
    mutationFn: () => api(`/api/v1/farms/${farmId}/bird-events`, {
      method: 'POST',
      json: birdEventInputSchema.parse({
        occurredOn,
        kind,
        birdCount: Number(birdCount),
        amount: kind === 'sold' ? Number(amount) : null,
        unitLabel: kind === 'sold' ? unitLabel : '',
        notes,
        batchId,
      }),
    }),
    onSuccess: async () => {
      setBirdCount('');
      setAmount('');
      setNotes('');
      await queryClient.invalidateQueries({ queryKey: ['desi', farmId] });
      await queryClient.invalidateQueries({ queryKey: ['batches', farmId] });
    },
  });
  if (desi.isLoading) return <p>{t('common.loading')}</p>;
  if (desi.isError || !desi.data) return <Alert>{explain(desi.error, t)}</Alert>;
  return (
    <div className="grid gap-4">
      <h1 className="font-display text-3xl font-semibold">{t('desi.birdsTitle')}</h1>
      <p className="text-ink-soft">{t('desi.birdsBody')}</p>
      <Card>
        <form className="grid gap-3" onSubmit={(event) => { event.preventDefault(); save.mutate(); }}>
          <Field id="bird-kind" label={t('desi.kind')}>
            <select id="bird-kind" className="min-h-11 w-full rounded-xl border border-line bg-white px-3" value={kind} onChange={(event) => setKind(event.target.value as 'died' | 'sold' | 'eaten')}>
              <option value="died">{t('desi.died')}</option>
              <option value="sold">{t('desi.sold')}</option>
              <option value="eaten">{t('desi.eaten')}</option>
            </select>
          </Field>
          <Field id="bird-date" label={t('desi.received')}>
            <Input id="bird-date" type="date" value={occurredOn} onChange={(event) => setOccurredOn(event.target.value)} />
          </Field>
          <Field id="bird-count" label={t('batches.count')} hint={t('desi.birdCountHint')}>
            <Input id="bird-count" inputMode="numeric" value={birdCount} placeholder="2" onChange={(event) => setBirdCount(event.target.value)} />
          </Field>
          <Field id="bird-batch" label={t('eggs.batch')}>
            <select id="bird-batch" className="min-h-11 w-full rounded-xl border border-line bg-white px-3" value={batchId} onChange={(event) => setBatchId(event.target.value)}>
              <option value="">{t('eggs.batchNone')}</option>
              {(batches.data ?? []).filter((batch) => batch.status === 'open').map((batch) => <option key={batch.id} value={batch.id}>{batch.code}</option>)}
            </select>
          </Field>
          {kind === 'sold' ? (
            <>
              <Field id="bird-amount" label={t('desi.amount')} hint={t('desi.amountHint')}>
                <Input id="bird-amount" inputMode="decimal" value={amount} placeholder="800" onChange={(event) => setAmount(event.target.value)} />
              </Field>
              <Field id="bird-unit" label={t('expenses.unit')} hint={t('desi.unitHint')}>
                <Input id="bird-unit" value={unitLabel} placeholder="Rs" onChange={(event) => setUnitLabel(event.target.value)} />
              </Field>
            </>
          ) : null}
          <Field id="bird-notes" label={t('eggs.notes')}>
            <TextArea id="bird-notes" value={notes} placeholder={t('desi.birdNotesPh')} onChange={(event) => setNotes(event.target.value)} />
          </Field>
          {save.isError ? <Alert>{explain(save.error, t)}</Alert> : null}
          <Button type="submit" disabled={save.isPending || Number(birdCount) < 1 || (kind === 'sold' && (Number(amount) <= 0 || unitLabel.trim() === ''))}>{t('desi.addBird')}</Button>
        </form>
      </Card>
      {desi.data.events.map((event) => (
        <Card key={event.id}>
          <p className="font-semibold">{t(`desi.${event.kind}`)} · {event.birdCount}</p>
          <p className="text-sm">{event.occurredOn}{event.batchCode ? ` · ${event.batchCode}` : ''}{event.amount !== null ? ` · ${event.amount} ${event.unitLabel ?? ''}` : ''}</p>
        </Card>
      ))}
    </div>
  );
}

export function IncomePage() {
  const { farmId = '' } = useParams();
  const { t } = useTranslation();
  const board = useQuery({
    queryKey: ['dashboard', farmId],
    queryFn: () => api<{ charts?: { money: Array<{ unitLabel: string | null; income: number | null; kharch: number | null; difference: number | null }> } }>(`/api/v1/farms/${farmId}/dashboard`),
  });
  const desi = useDesi(farmId);
  if (board.isLoading) return <p>{t('common.loading')}</p>;
  if (board.isError) return <Alert>{explain(board.error, t)}</Alert>;
  return (
    <div className="grid gap-4">
      <h1 className="font-display text-3xl font-semibold">{t('desi.incomeTitle')}</h1>
      <p className="text-ink-soft">{t('desi.incomeBody')}</p>
      <p className="text-sm text-ink-soft">{t('dash.chart.moneyNote')}</p>
      {(board.data?.charts?.money ?? []).map((row, index) => (
        <Card key={`${row.unitLabel ?? 'sales'}-${index}`}>
          <p className="font-semibold">{row.unitLabel ?? t('dash.chart.sales')}</p>
          <p>{t('dash.chart.income')}: {row.income ?? t('dash.notSet')}</p>
          <p>{t('dash.chart.kharch')}: {row.kharch ?? t('dash.notSet')}</p>
          <p>{t('dash.chart.difference')}: {row.difference ?? t('dash.notSet')}</p>
        </Card>
      ))}
      <h2 className="font-display text-2xl">{t('desi.sold')}</h2>
      {(desi.data?.events ?? []).filter((event) => event.kind === 'sold').map((event) => (
        <Card key={event.id}><p>{event.occurredOn} · {event.birdCount} · {event.amount} {event.unitLabel}</p></Card>
      ))}
      <Link className="font-semibold text-grove underline" to={`/farms/${farmId}/expenses`}>{t('desi.openKharch')}</Link>
      <Link className="font-semibold text-grove underline" to={`/farms/${farmId}/sales`}>{t('desi.openSales')}</Link>
    </div>
  );
}

export function SeasonCard({ farmId }: { farmId: string }) {
  const { t } = useTranslation();
  const [season, setSeason] = useState(() => localStorage.getItem(`gavran.season.${farmId}`) ?? '');
  return (
    <Card>
      <h2 className="font-display text-xl">{t('desi.seasonTitle')}</h2>
      <p className="text-sm text-ink-soft">{t('desi.seasonPick')}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {(['summer', 'winter', 'rainy'] as const).map((item) => (
          <Button key={item} type="button" variant={season === item ? 'default' : 'outline'} onClick={() => { setSeason(item); localStorage.setItem(`gavran.season.${farmId}`, item); }}>
            {t(`desi.season.${item}`)}
          </Button>
        ))}
      </div>
      {season ? <p className="mt-3 text-sm">{t(`desi.routine.${season}`)}</p> : null}
    </Card>
  );
}
