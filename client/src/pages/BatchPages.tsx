import { batchInputSchema, birdTypeInputSchema, movementInputSchema, MOVEMENT_TYPES, rangeAreaInputSchema, sexCountInputSchema } from '@gavran/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import { z } from 'zod';
import { ScreenTour } from '@/components/Tour';
import { Alert, Button, Card, Field, Input, TextArea } from '@/components/ui';
import { ApiError, api, errorKey } from '@/lib/api';
import type { Batch, BatchMovement, BirdType, FarmSummary, RangeArea, SexCount, Shed } from '@/lib/types';
import { localToday } from '@/lib/today';

function text(t: (key: string, options?: { defaultValue?: string }) => string, code?: string) {
  if (!code) return undefined;
  return t(`validation.${code}`, { defaultValue: t('validation.invalid') });
}

function explain(error: unknown, t: (key: string) => string) {
  if (error instanceof ApiError) {
    if (error.status === 403) return t('common.permissionDenied');
    if (error.status === 404) return t('farm.notFound');
    const key = errorKey(error);
    return key ? t(key) : t('common.errorGeneric');
  }
  return t('common.errorGeneric');
}

function applyFields(error: unknown, setError: (name: string, err: { message: string }) => void) {
  if (!(error instanceof ApiError) || !error.details?.fields) return;
  for (const [key, code] of Object.entries(error.details.fields)) setError(key, { message: code });
}

const selectClass = 'min-h-11 rounded-xl border border-line bg-white px-3';

export function BatchesPage() {
  const { farmId = '' } = useParams();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const farms = useQuery({ queryKey: ['farms'], queryFn: () => api<FarmSummary[]>('/api/v1/farms') });
  const access = farms.data?.find((farm) => farm.id === farmId);
  const batches = useQuery({ queryKey: ['batches', farmId], queryFn: () => api<Batch[]>(`/api/v1/farms/${farmId}/batches`) });
  const types = useQuery({ queryKey: ['bird-types', farmId], queryFn: () => api<BirdType[]>(`/api/v1/farms/${farmId}/bird-types`) });
  const sheds = useQuery({ queryKey: ['sheds', farmId], queryFn: () => api<Shed[]>(`/api/v1/farms/${farmId}/sheds`) });
  const canCreate = Boolean(access?.permissions.includes('batch.create'));

  if (batches.isLoading || types.isLoading) return <p>{t('common.loading')}</p>;
  if (batches.isError || !batches.data) return <Alert>{explain(batches.error, t)}</Alert>;

  return (
    <div className="grid gap-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 data-tour="screen-title" className="font-display text-3xl font-semibold">{t('batches.title')}</h1>
          <p data-tour="screen-body" className="mt-1 text-ink-soft">{t('batches.body')}</p>
          <ScreenTour screen="batches" />
        </div>
        {canCreate ? (
          <Button data-tour="screen-action" type="button" variant="outline" onClick={() => setOpen((value) => !value)}>
            {open ? t('batches.hideForm') : t('batches.add')}
          </Button>
        ) : null}
      </div>
      <p className="rounded-xl bg-gold/30 px-3 py-2 text-sm">{t('batches.ledgerNote')}</p>
      {canCreate ? <BirdTypeForm farmId={farmId} onDone={() => void queryClient.invalidateQueries({ queryKey: ['bird-types', farmId] })} /> : null}
      {open ? (
        <BatchForm
          farmId={farmId}
          types={(types.data ?? []).filter((item) => item.status === 'active')}
          sheds={(sheds.data ?? []).filter((shed) => shed.status === 'active')}
          onDone={() => {
            setOpen(false);
            void queryClient.invalidateQueries({ queryKey: ['batches', farmId] });
          }}
        />
      ) : null}
      {batches.data.length === 0 ? (
        <Card>
          <h2 className="font-display text-2xl">{t('batches.emptyTitle')}</h2>
          <p className="text-ink-soft">{t('batches.emptyBody')}</p>
        </Card>
      ) : (
        <div className="grid gap-3">
          {batches.data.map((batch) => (
            <Card key={batch.id}>
              <p className="text-sm font-semibold text-ink-soft">{batch.code}</p>
              <h2 className="font-display text-2xl">{batch.birdTypeName}</h2>
              <p className="text-sm">
                {t('batches.live', { count: batch.liveCount })} · {t(`batches.status.${batch.status}`)}
              </p>
              <Button asChild className="mt-3" variant="outline">
                <Link to={`/farms/${farmId}/batches/${batch.id}`}>{t('batches.open')}</Link>
              </Button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function BirdTypeForm({ farmId, onDone }: { farmId: string; onDone: () => void }) {
  const { t } = useTranslation();
  const form = useForm<z.infer<typeof birdTypeInputSchema>>({
    resolver: zodResolver(birdTypeInputSchema),
    defaultValues: { name: '', strainNote: '' },
  });
  const mutation = useMutation({
    mutationFn: (values: z.infer<typeof birdTypeInputSchema>) => api(`/api/v1/farms/${farmId}/bird-types`, { method: 'POST', json: values }),
    onSuccess: () => {
      form.reset();
      onDone();
    },
    onError: (error) => applyFields(error, (name, err) => form.setError(name as 'name', err)),
  });
  return (
    <Card>
      <form className="grid gap-3" onSubmit={form.handleSubmit((values) => mutation.mutate(values))} noValidate>
        <Field id="bird-type" label={t('batches.birdType')} hint={t('batches.birdTypeHint')} error={text(t, form.formState.errors.name?.message)}>
          <Input id="bird-type" {...form.register('name')}  placeholder={t('fieldPh.bird-type')}/>
        </Field>
        <Field id="bird-strain" label={`${t('batches.strain')} (${t('common.optional')})`} hint={t('batches.strainHint')}>
          <Input id="bird-strain" {...form.register('strainNote')}  placeholder={t('fieldPh.bird-strain')}/>
        </Field>
        {mutation.isError ? <Alert>{explain(mutation.error, t)}</Alert> : null}
        <Button type="submit" variant="outline" disabled={mutation.isPending}>
          {t('batches.saveType')}
        </Button>
      </form>
    </Card>
  );
}

function BatchForm({
  farmId,
  types,
  sheds,
  onDone,
}: {
  farmId: string;
  types: BirdType[];
  sheds: Shed[];
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const today = localToday();
  const form = useForm<z.infer<typeof batchInputSchema>>({
    resolver: zodResolver(batchInputSchema),
    defaultValues: {
      code: '',
      birdTypeId: types[0]?.id ?? '',
      sourceNote: '',
      hatchDate: '',
      openedOn: today,
      shedId: sheds[0]?.id ?? '',
      birdCount: 1,
    },
  });
  const mutation = useMutation({
    mutationFn: (values: z.infer<typeof batchInputSchema>) => api(`/api/v1/farms/${farmId}/batches`, { method: 'POST', json: values }),
    onSuccess: onDone,
    onError: (error) => applyFields(error, (name, err) => form.setError(name as 'code', err)),
  });
  const errors = form.formState.errors;
  const openedOn = form.watch('openedOn');
  return (
    <Card>
      <form className="grid gap-3" onSubmit={form.handleSubmit((values) => mutation.mutate(values))} noValidate>
        <Field id="batch-code" label={t('batches.code')} error={text(t, errors.code?.message)} hint={t('fieldHint.batch-code')}>
          <Input id="batch-code" {...form.register('code')}  placeholder={t('fieldPh.batch-code')}/>
        </Field>
        <Field id="batch-type" label={t('batches.birdType')} error={text(t, errors.birdTypeId?.message)} hint={t('fieldHint.batch-type')}>
          <select id="batch-type" className={selectClass} {...form.register('birdTypeId')}>
            {types.map((type) => (
              <option key={type.id} value={type.id}>
                {type.name}{type.strainNote ? ` · ${type.strainNote}` : ''}
              </option>
            ))}
          </select>
        </Field>
        <Field id="batch-shed" label={t('batches.shed')} error={text(t, errors.shedId?.message)} hint={t('fieldHint.batch-shed')}>
          <select id="batch-shed" className={selectClass} {...form.register('shedId')}>
            {sheds.map((shed) => (
              <option key={shed.id} value={shed.id}>
                {shed.code} · {shed.name}
              </option>
            ))}
          </select>
        </Field>
        <Field id="batch-count" label={t('batches.count')} hint={t('batches.countHint')} error={text(t, errors.birdCount?.message)}>
          <Input id="batch-count" type="number" min={1} placeholder={t('batches.countPlaceholder')} {...form.register('birdCount', { valueAsNumber: true })} />
        </Field>
        <Field id="batch-opened" label={t('batches.openedOn')} hint={t('batches.openedHint')} error={text(t, errors.openedOn?.message)}>
          <Input id="batch-opened" type="date" {...form.register('openedOn')} />
        </Field>
        <Field id="batch-hatch" label={`${t('batches.hatchDate')} (${t('common.optional')})`} hint={t('batches.hatchHint')} error={text(t, errors.hatchDate?.message)}>
          <Input id="batch-hatch" type="date" max={openedOn || undefined} {...form.register('hatchDate')} />
        </Field>
        <Field id="batch-source" label={`${t('batches.source')} (${t('common.optional')})`} error={text(t, errors.sourceNote?.message)} hint={t('fieldHint.batch-source')}>
          <TextArea id="batch-source" {...form.register('sourceNote')}  placeholder={t('fieldPh.batch-source')}/>
        </Field>
        {types.length === 0 ? <Alert>{t('batches.needType')}</Alert> : null}
        {mutation.isError ? <Alert>{explain(mutation.error, t)}</Alert> : null}
        <Button type="submit" disabled={mutation.isPending || types.length === 0 || sheds.length === 0}>
          {mutation.isPending ? t('batches.saving') : t('batches.save')}
        </Button>
      </form>
    </Card>
  );
}

export function BatchDetailPage() {
  const { farmId = '', batchId = '' } = useParams();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const farms = useQuery({ queryKey: ['farms'], queryFn: () => api<FarmSummary[]>('/api/v1/farms') });
  const access = farms.data?.find((farm) => farm.id === farmId);
  const detail = useQuery({
    queryKey: ['batch', farmId, batchId],
    queryFn: () => api<{ batch: Batch; movements: BatchMovement[] }>(`/api/v1/farms/${farmId}/batches/${batchId}`),
  });
  const sheds = useQuery({ queryKey: ['sheds', farmId], queryFn: () => api<Shed[]>(`/api/v1/farms/${farmId}/sheds`) });
  const areas = useQuery({ queryKey: ['range-areas', farmId], queryFn: () => api<RangeArea[]>(`/api/v1/farms/${farmId}/range-areas`) });
  const sexes = useQuery({ queryKey: ['sex-counts', farmId], queryFn: () => api<SexCount[]>(`/api/v1/farms/${farmId}/sex-counts`) });
  if (detail.isLoading) return <p>{t('common.loading')}</p>;
  if (detail.isError || !detail.data) return <Alert>{explain(detail.error, t)}</Alert>;
  const { batch, movements } = detail.data;
  const canMove = Boolean(access?.permissions.includes('movement.create') && batch.status === 'open');
  return (
    <div className="grid gap-4">
      <div>
        <p className="text-sm font-semibold text-ink-soft">{batch.code}</p>
        <h1 className="font-display text-3xl font-semibold">{batch.birdTypeName}</h1>
        <p className="mt-1 text-ink-soft">
          {t('batches.live', { count: batch.liveCount })} · {t(`batches.status.${batch.status}`)}
        </p>
        {batch.sourceNote ? <p className="mt-2 text-sm">{batch.sourceNote}</p> : null}
      </div>
      <Card>
        <h2 className="font-display text-2xl">{t('batches.where')}</h2>
        {batch.placements.length === 0 ? (
          <p className="mt-1 text-ink-soft">{t('batches.noneHere')}</p>
        ) : (
          <ul className="mt-2 grid gap-1 text-sm">
            {batch.placements.map((place) => (
              <li key={place.shedId}>
                {place.shedCode} · {place.shedName}: {place.birdCount}
              </li>
            ))}
          </ul>
        )}
        {batch.rangePlacements.length > 0 ? (
          <ul className="mt-2 grid gap-1 text-sm">
            {batch.rangePlacements.map((place) => (
              <li key={place.rangeAreaId}>
                {place.name}: {place.birdCount}
              </li>
            ))}
          </ul>
        ) : null}
      </Card>
      {canMove ? (
        <RangeAreaForm farmId={farmId} onDone={() => void queryClient.invalidateQueries({ queryKey: ['range-areas', farmId] })} />
      ) : null}
      {canMove && sheds.data ? (
        <MovementForm
          farmId={farmId}
          batchId={batchId}
          sheds={sheds.data}
          areas={areas.data ?? []}
          onDone={() => void queryClient.invalidateQueries({ queryKey: ['batch', farmId, batchId] })}
        />
      ) : null}
      <SexCounts
        farmId={farmId}
        batchId={batchId}
        batchCode={batch.code}
        canRecord={canMove}
        rows={(sexes.data ?? []).filter((row) => row.batchId === batchId || row.batchId === null)}
        onDone={() => void queryClient.invalidateQueries({ queryKey: ['sex-counts', farmId] })}
      />
      {canMove && batch.liveCount === 0 ? (
        <CloseBatch
          farmId={farmId}
          batch={batch}
          onDone={() => void queryClient.invalidateQueries({ queryKey: ['batch', farmId, batchId] })}
        />
      ) : null}
      <div>
        <h2 className="font-display text-2xl">{t('batches.timeline')}</h2>
        <ol className="mt-2 grid gap-2">
          {movements.map((movement) => (
            <li key={movement.id}>
              <Card>
                <p className="font-semibold">
                  {t(`batches.movement.${movement.movementType}`, { defaultValue: movement.movementType })} · {movement.birdCount}
                </p>
                <p className="text-sm text-ink-soft">
                  {movement.occurredOn}
                  {movement.fromShedCode ? ` · ${movement.fromShedCode}` : ''}
                  {movement.toShedCode ? ` → ${movement.toShedCode}` : ''}
                  {movement.fromRangeName ? ` · ${movement.fromRangeName}` : ''}
                  {movement.toRangeName ? ` → ${movement.toRangeName}` : ''}
                  {movement.reason ? ` · ${movement.reason}` : ''}
                </p>
              </Card>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

function MovementForm({ farmId, batchId, sheds, areas, onDone }: { farmId: string; batchId: string; sheds: Shed[]; areas: RangeArea[]; onDone: () => void }) {
  const { t } = useTranslation();
  const today = localToday();
  const form = useForm<z.infer<typeof movementInputSchema>>({
    resolver: zodResolver(movementInputSchema),
    defaultValues: {
      movementType: 'transfer',
      fromShedId: sheds[0]?.id ?? '',
      toShedId: sheds[1]?.id ?? sheds[0]?.id ?? '',
      fromRangeAreaId: '',
      toRangeAreaId: areas[0]?.id ?? '',
      birdCount: 1,
      occurredOn: today,
      reason: '',
    },
  });
  const kind = form.watch('movementType');
  const exit = kind === 'sale' || kind === 'mortality' || kind === 'culling' || kind === 'other_exit';
  const [fromRange, setFromRange] = useState(false);
  const mutation = useMutation({
    mutationFn: (values: z.infer<typeof movementInputSchema>) =>
      api(`/api/v1/farms/${farmId}/batches/${batchId}/movements`, {
        method: 'POST',
        json: {
          ...values,
          fromShedId: kind === 'from_range' || (exit && fromRange) ? '' : values.fromShedId,
          toShedId: kind === 'transfer' || kind === 'from_range' ? values.toShedId : '',
          toRangeAreaId: kind === 'to_range' ? values.toRangeAreaId : '',
          fromRangeAreaId: kind === 'from_range' || (exit && fromRange) ? values.fromRangeAreaId : '',
        },
      }),
    onSuccess: onDone,
    onError: (error) => applyFields(error, (name, err) => form.setError(name as 'birdCount', err)),
  });
  const errors = form.formState.errors;
  const showFromShed = kind !== 'from_range' && !(exit && fromRange);
  const showToShed = kind === 'transfer' || kind === 'from_range';
  return (
    <Card>
      <form className="grid gap-3" onSubmit={form.handleSubmit((values) => mutation.mutate(values))} noValidate>
        <h2 className="font-display text-2xl">{t('batches.record')}</h2>
        <Field id="move-type" label={t('batches.movementType')} error={text(t, errors.movementType?.message)} hint={t('fieldHint.move-type')}>
          <select id="move-type" className={selectClass} {...form.register('movementType')}>
            {MOVEMENT_TYPES.map((type) => (
              <option key={type} value={type}>
                {t(`batches.movement.${type}`)}
              </option>
            ))}
          </select>
        </Field>
        {exit ? (
          <label className="flex min-h-11 items-center gap-2 text-sm font-semibold">
            <input type="checkbox" checked={fromRange} onChange={(event) => setFromRange(event.target.checked)} />
            {t('batches.fromRangeInstead')}
          </label>
        ) : null}
        {showFromShed ? (
          <Field id="move-from" label={t('batches.fromShed')} error={text(t, errors.fromShedId?.message)} hint={t('fieldHint.move-from')}>
            <select id="move-from" className={selectClass} {...form.register('fromShedId')}>
              {sheds.map((shed) => (
                <option key={shed.id} value={shed.id}>{shed.code}</option>
              ))}
            </select>
          </Field>
        ) : null}
        {kind === 'from_range' || (exit && fromRange) ? (
          <Field id="move-from-range" label={t('batches.fromRange')} error={text(t, errors.fromRangeAreaId?.message)} hint={t('fieldHint.move-from-range')}>
            <select id="move-from-range" className={selectClass} {...form.register('fromRangeAreaId')}>
              <option value="">{t('batches.chooseRange')}</option>
              {areas.map((area) => (
                <option key={area.id} value={area.id}>{area.name}</option>
              ))}
            </select>
          </Field>
        ) : null}
        {showToShed ? (
          <Field id="move-to" label={t('batches.toShed')} error={text(t, errors.toShedId?.message)} hint={t('fieldHint.move-to')}>
            <select id="move-to" className={selectClass} {...form.register('toShedId')}>
              {sheds.map((shed) => (
                <option key={shed.id} value={shed.id}>{shed.code}</option>
              ))}
            </select>
          </Field>
        ) : null}
        {kind === 'to_range' ? (
          <Field id="move-to-range" label={t('batches.toRange')} error={text(t, errors.toRangeAreaId?.message)} hint={t('fieldHint.move-to-range')}>
            <select id="move-to-range" className={selectClass} {...form.register('toRangeAreaId')}>
              <option value="">{t('batches.chooseRange')}</option>
              {areas.map((area) => (
                <option key={area.id} value={area.id}>{area.name}</option>
              ))}
            </select>
          </Field>
        ) : null}
        <Field id="move-count" label={t('batches.count')} error={text(t, errors.birdCount?.message)} hint={t('fieldHint.move-count')}>
          <Input id="move-count" type="number" min={1} {...form.register('birdCount', { valueAsNumber: true })}  placeholder={t('fieldPh.move-count')}/>
        </Field>
        <Field id="move-date" label={t('batches.date')} error={text(t, errors.occurredOn?.message)} hint={t('fieldHint.move-date')}>
          <Input id="move-date" type="date" {...form.register('occurredOn')} />
        </Field>
        <Field id="move-reason" label={`${t('batches.reason')} (${t('common.optional')})`} error={text(t, errors.reason?.message)} hint={t('fieldHint.move-reason')}>
          <Input id="move-reason" {...form.register('reason')}  placeholder={t('fieldPh.move-reason')}/>
        </Field>
        <p className="text-sm text-ink-soft">{t('batches.noPrice')}</p>
        {mutation.isError ? <Alert>{explain(mutation.error, t)}</Alert> : null}
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? t('batches.saving') : t('batches.saveMovement')}
        </Button>
      </form>
    </Card>
  );
}

function RangeAreaForm({ farmId, onDone }: { farmId: string; onDone: () => void }) {
  const { t } = useTranslation();
  const form = useForm<z.infer<typeof rangeAreaInputSchema>>({
    resolver: zodResolver(rangeAreaInputSchema),
    defaultValues: { name: '', notes: '' },
  });
  const mutation = useMutation({
    mutationFn: (values: z.infer<typeof rangeAreaInputSchema>) => api(`/api/v1/farms/${farmId}/range-areas`, { method: 'POST', json: values }),
    onSuccess: () => {
      form.reset({ name: '', notes: '' });
      onDone();
    },
  });
  return (
    <Card>
      <form className="grid gap-3" onSubmit={form.handleSubmit((values) => mutation.mutate(values))}>
        <h2 className="font-display text-2xl">{t('batches.rangeTitle')}</h2>
        <p className="text-sm text-ink-soft">{t('batches.rangeBody')}</p>
        <Field id="range-name" label={t('batches.rangeName')} error={text(t, form.formState.errors.name?.message)} hint={t('fieldHint.range-name')}>
          <Input id="range-name" {...form.register('name')}  placeholder={t('fieldPh.range-name')}/>
        </Field>
        {mutation.isError ? <Alert>{explain(mutation.error, t)}</Alert> : null}
        <Button type="submit" variant="outline">{mutation.isPending ? t('batches.saving') : t('batches.saveRange')}</Button>
      </form>
    </Card>
  );
}

function SexCounts({
  farmId,
  batchId,
  batchCode,
  canRecord,
  rows,
  onDone,
}: {
  farmId: string;
  batchId: string;
  batchCode: string;
  canRecord: boolean;
  rows: SexCount[];
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const form = useForm<z.infer<typeof sexCountInputSchema>>({
    resolver: zodResolver(sexCountInputSchema),
    defaultValues: { countedOn: localToday(), batchId, roosterCount: '' as unknown as number, henCount: '' as unknown as number },
  });
  const mutation = useMutation({
    mutationFn: (values: z.infer<typeof sexCountInputSchema>) => api(`/api/v1/farms/${farmId}/sex-counts`, {
      method: 'POST',
      json: { ...values, batchId, roosterCount: Number(values.roosterCount), henCount: Number(values.henCount) },
    }),
    onSuccess: () => {
      form.reset({ countedOn: localToday(), batchId, roosterCount: '' as unknown as number, henCount: '' as unknown as number });
      onDone();
    },
  });
  return (
    <Card>
      <h2 className="font-display text-2xl">{t('batches.sexTitle')}</h2>
      <p className="text-sm text-ink-soft">{t('batches.sexBody')}</p>
      {rows.length === 0 ? <p className="mt-2">{t('batches.sexEmpty')}</p> : (
        <ul className="mt-2 grid gap-1 text-sm">
          {rows.map((row) => (
            <li key={row.id}>{row.countedOn} · {t('batches.sexLine', { roosters: row.roosterCount, hens: row.henCount, batch: row.batchCode ?? batchCode })}</li>
          ))}
        </ul>
      )}
      {canRecord ? (
        <form className="mt-3 grid gap-3" onSubmit={form.handleSubmit((values) => mutation.mutate(values))}>
          <Field id="sex-date" label={t('batches.date')} hint={t('fieldHint.sex-date')}>
            <Input id="sex-date" type="date" {...form.register('countedOn')} />
          </Field>
          <Field id="sex-roosters" label={t('batches.roosters')} hint={t('fieldHint.sex-roosters')}>
            <Input id="sex-roosters" type="number" min={0} {...form.register('roosterCount', { valueAsNumber: true })}  placeholder={t('fieldPh.sex-roosters')}/>
          </Field>
          <Field id="sex-hens" label={t('batches.hens')} hint={t('fieldHint.sex-hens')}>
            <Input id="sex-hens" type="number" min={0} {...form.register('henCount', { valueAsNumber: true })}  placeholder={t('fieldPh.sex-hens')}/>
          </Field>
          {mutation.isError ? <Alert>{explain(mutation.error, t)}</Alert> : null}
          <Button type="submit" variant="outline">{mutation.isPending ? t('batches.saving') : t('batches.saveSex')}</Button>
        </form>
      ) : null}
    </Card>
  );
}

function CloseBatch({ farmId, batch, onDone }: { farmId: string; batch: Batch; onDone: () => void }) {
  const { t } = useTranslation();
  const mutation = useMutation({
    mutationFn: () => api(`/api/v1/farms/${farmId}/batches/${batch.id}/close`, { method: 'POST', json: { version: batch.version } }),
    onSuccess: onDone,
  });
  return (
    <Card>
      <p>{t('batches.closeBody')}</p>
      {mutation.isError ? <Alert>{explain(mutation.error, t)}</Alert> : null}
      <Button type="button" className="mt-3" variant="clay" disabled={mutation.isPending} onClick={() => mutation.mutate()}>
        {t('batches.close')}
      </Button>
    </Card>
  );
}
