import { candlingInputSchema, hatchInputSchema, incubationInputSchema } from '@gavran/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import { z } from 'zod';
import { Alert, Button, Card, Field, Input, TextArea } from '@/components/ui';
import { ApiError, api, errorKey } from '@/lib/api';
import type { BirdType, CandlingRecord, FarmSummary, HatchRecord, Incubator, ProposedHatchRate, Shed, Sitting } from '@/lib/types';
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

const selectClass = 'min-h-11 w-full rounded-xl border border-line bg-white px-3';

export function IncubationPage() {
  const { farmId = '' } = useParams();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const farms = useQuery({ queryKey: ['farms'], queryFn: () => api<FarmSummary[]>('/api/v1/farms') });
  const access = farms.data?.find((farm) => farm.id === farmId);
  const sittings = useQuery({ queryKey: ['incubation', farmId], queryFn: () => api<Sitting[]>(`/api/v1/farms/${farmId}/incubation`) });
  const canRecord = Boolean(access?.permissions.includes('incubation.record'));
  if (sittings.isLoading) return <p>{t('common.loading')}</p>;
  if (sittings.isError || !sittings.data) return <Alert>{explain(sittings.error, t)}</Alert>;
  return (
    <div className="grid gap-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold">{t('incubation.title')}</h1>
          <p className="mt-1 text-ink-soft">{t('incubation.body')}</p>
        </div>
        {canRecord ? (
          <Button type="button" variant="outline" onClick={() => setOpen((value) => !value)}>
            {open ? t('incubation.hideForm') : t('incubation.add')}
          </Button>
        ) : null}
      </div>
      <p className="rounded-xl bg-gold/30 px-3 py-2 text-sm">{t('incubation.noDate')}</p>
      {open && canRecord ? (
        <SittingForm
          farmId={farmId}
          onDone={() => {
            setOpen(false);
            void queryClient.invalidateQueries({ queryKey: ['incubation', farmId] });
          }}
        />
      ) : null}
      {sittings.data.length === 0 ? (
        <Card>
          <h2 className="font-display text-2xl">{t('incubation.emptyTitle')}</h2>
          <p className="text-ink-soft">{t('incubation.emptyBody')}</p>
        </Card>
      ) : (
        <div className="grid gap-3">
          {sittings.data.map((item) => (
            <Card key={item.id}>
              <p className="text-sm font-semibold text-ink-soft">{item.code}</p>
              <h2 className="font-display text-2xl">{item.mode === 'broody_hen' ? item.henName : item.incubatorCode}</h2>
              <p className="text-sm">
                {t(`incubation.mode.${item.mode}`)} · {t('incubation.eggs', { count: item.eggCount })} · {item.startedOn}
              </p>
              <Button asChild className="mt-3" variant="outline">
                <Link to={`/farms/${farmId}/incubation/${item.id}`}>{t('incubation.open')}</Link>
              </Button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function SittingForm({ farmId, onDone }: { farmId: string; onDone: () => void }) {
  const { t } = useTranslation();
  const today = localToday();
  const machines = useQuery({ queryKey: ['incubators', farmId], queryFn: () => api<Incubator[]>(`/api/v1/farms/${farmId}/incubators`) });
  const form = useForm<z.infer<typeof incubationInputSchema>>({
    resolver: zodResolver(incubationInputSchema),
    defaultValues: { code: '', mode: 'broody_hen', incubatorId: '', henName: '', startedOn: today, eggCount: 1, notes: '' },
  });
  const mode = form.watch('mode');
  const mutation = useMutation({
    mutationFn: (values: z.infer<typeof incubationInputSchema>) => api(`/api/v1/farms/${farmId}/incubation`, { method: 'POST', json: values }),
    onSuccess: onDone,
  });
  const inService = (machines.data ?? []).filter((item) => item.status === 'in_service');
  return (
    <Card>
      <form className="grid gap-3" noValidate onSubmit={form.handleSubmit((values) => mutation.mutate(values))}>
        <Field id="sit-code" label={t('incubation.code')} error={text(t, form.formState.errors.code?.message)} hint={t('fieldHint.sit-code')}>
          <Input id="sit-code" {...form.register('code')}  placeholder={t('fieldPh.sit-code')}/>
        </Field>
        <Field id="sit-mode" label={t('incubation.where')} hint={t('fieldHint.sit-mode')}>
          <select id="sit-mode" className={selectClass} {...form.register('mode')}>
            <option value="broody_hen">{t('incubation.mode.broody_hen')}</option>
            <option value="incubator">{t('incubation.mode.incubator')}</option>
          </select>
        </Field>
        {mode === 'broody_hen' ? (
          <Field id="sit-hen" label={t('incubation.hen')} error={text(t, form.formState.errors.henName?.message)} hint={t('fieldHint.sit-hen')}>
            <Input id="sit-hen" {...form.register('henName')}  placeholder={t('fieldPh.sit-hen')}/>
          </Field>
        ) : (
          <Field id="sit-machine" label={t('incubation.machine')} error={text(t, form.formState.errors.incubatorId?.message)} hint={t('fieldHint.sit-machine')}>
            <select id="sit-machine" className={selectClass} {...form.register('incubatorId')}>
              <option value="">{t('incubation.chooseMachine')}</option>
              {inService.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.code} · {item.name}
                </option>
              ))}
            </select>
          </Field>
        )}
        <Field id="sit-date" label={t('incubation.started')} error={text(t, form.formState.errors.startedOn?.message)} hint={t('fieldHint.sit-date')}>
          <Input id="sit-date" type="date" {...form.register('startedOn')} />
        </Field>
        <Field id="sit-count" label={t('incubation.eggCount')} error={text(t, form.formState.errors.eggCount?.message)} hint={t('fieldHint.sit-count')}>
          <Input id="sit-count" type="number" min={1} {...form.register('eggCount', { valueAsNumber: true })}  placeholder={t('fieldPh.sit-count')}/>
        </Field>
        <Field id="sit-notes" label={`${t('incubators.notes')} (${t('common.optional')})`} hint={t('fieldHint.sit-notes')}>
          <TextArea id="sit-notes" {...form.register('notes')}  placeholder={t('fieldPh.sit-notes')}/>
        </Field>
        {mutation.isError ? <Alert>{explain(mutation.error, t)}</Alert> : null}
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? t('incubators.saving') : t('incubation.save')}
        </Button>
      </form>
    </Card>
  );
}

export function IncubationDetailPage() {
  const { farmId = '', sittingId = '' } = useParams();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const farms = useQuery({ queryKey: ['farms'], queryFn: () => api<FarmSummary[]>('/api/v1/farms') });
  const access = farms.data?.find((farm) => farm.id === farmId);
  const detail = useQuery({
    queryKey: ['incubation', farmId, sittingId],
    queryFn: () => api<{ sitting: Sitting; candling: CandlingRecord[]; hatches: HatchRecord[] }>(`/api/v1/farms/${farmId}/incubation/${sittingId}`),
  });
  if (detail.isLoading) return <p>{t('common.loading')}</p>;
  if (detail.isError || !detail.data) return <Alert>{explain(detail.error, t)}</Alert>;
  const { sitting, candling, hatches } = detail.data;
  const canRecord = Boolean(access?.permissions.includes('incubation.record') && sitting.status === 'open');
  const canHatch = Boolean(access?.permissions.includes('hatch.record') && sitting.status === 'open');
  return (
    <div className="grid gap-4">
      <div>
        <p className="text-sm font-semibold text-ink-soft">{sitting.code}</p>
        <h1 className="font-display text-3xl font-semibold">{sitting.mode === 'broody_hen' ? sitting.henName : sitting.incubatorCode}</h1>
        <p className="mt-1 text-ink-soft">
          {t(`incubation.mode.${sitting.mode}`)} · {t('incubation.eggs', { count: sitting.eggCount })} · {sitting.startedOn}
        </p>
      </div>
      <p className="rounded-xl bg-gold/30 px-3 py-2 text-sm">{t('incubation.noDate')}</p>
      {canHatch ? (
        <HatchForm
          farmId={farmId}
          sittingId={sittingId}
          onDone={() => void queryClient.invalidateQueries({ queryKey: ['incubation', farmId, sittingId] })}
        />
      ) : null}
      <Card>
        <h2 className="font-display text-2xl">{t('hatch.title')}</h2>
        <p className="text-sm text-ink-soft">{t('hatch.proposedNote')}</p>
        {hatches.length === 0 ? (
          <p className="mt-1 text-ink-soft">{t('hatch.empty')}</p>
        ) : (
          <ul className="mt-2 grid gap-2 text-sm">
            {hatches.map((item) => (
              <li key={item.id}>
                {item.hatchedOn} · {t('hatch.live', { count: item.liveChicks })} / {t('hatch.set', { count: item.eggsSet })}
                {item.chickBatchCode ? ` · ${item.chickBatchCode}` : ''}
                {item.differenceNote ? <span className="block text-ink-soft">{item.differenceNote}</span> : null}
              </li>
            ))}
          </ul>
        )}
      </Card>
      {canRecord ? (
        <CandlingForm
          farmId={farmId}
          sittingId={sittingId}
          onDone={() => void queryClient.invalidateQueries({ queryKey: ['incubation', farmId, sittingId] })}
        />
      ) : null}
      <Card>
        <h2 className="font-display text-2xl">{t('incubation.candling')}</h2>
        {candling.length === 0 ? (
          <p className="mt-1 text-ink-soft">{t('incubation.noCandling')}</p>
        ) : (
          <ul className="mt-2 grid gap-2 text-sm">
            {candling.map((record) => (
              <li key={record.id}>
                <p className="font-semibold">
                  {record.observedOn} · {t('incubation.inspected', { count: record.inspectedCount })}
                </p>
                <ul>
                  {record.lines.map((line) => (
                    <li key={line.label}>
                      {line.label}: {line.eggCount}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function HatchForm({ farmId, sittingId, onDone }: { farmId: string; sittingId: string; onDone: () => void }) {
  const { t } = useTranslation();
  const today = localToday();
  const types = useQuery({ queryKey: ['bird-types', farmId], queryFn: () => api<BirdType[]>(`/api/v1/farms/${farmId}/bird-types`) });
  const sheds = useQuery({ queryKey: ['sheds', farmId], queryFn: () => api<Shed[]>(`/api/v1/farms/${farmId}/sheds`) });
  const [rate, setRate] = useState<ProposedHatchRate | null>(null);
  const form = useForm<z.infer<typeof hatchInputSchema>>({
    resolver: zodResolver(hatchInputSchema),
    defaultValues: {
      hatchedOn: today,
      eggsSet: 0,
      liveChicks: 0,
      losses: 0,
      otherCount: 0,
      differenceNote: '',
      batchCode: '',
      birdTypeId: '',
      shedId: '',
    },
  });
  const mutation = useMutation({
    mutationFn: (values: z.infer<typeof hatchInputSchema>) =>
      api<{ hatch: HatchRecord; proposedHatchRate: ProposedHatchRate }>(`/api/v1/farms/${farmId}/incubation/${sittingId}/hatches`, {
        method: 'POST',
        json: values,
      }),
    onSuccess: (data) => {
      setRate(data.proposedHatchRate);
      onDone();
    },
  });
  const live = form.watch('liveChicks');
  return (
    <Card>
      <form className="grid gap-3" noValidate onSubmit={form.handleSubmit((values) => mutation.mutate(values))}>
        <h2 className="font-display text-2xl">{t('hatch.record')}</h2>
        <Field id="hatch-date" label={t('hatch.date')} hint={t('fieldHint.hatch-date')}>
          <Input id="hatch-date" type="date" {...form.register('hatchedOn')} />
        </Field>
        <Field id="hatch-set" label={t('hatch.eggsSet')} error={text(t, form.formState.errors.eggsSet?.message)} hint={t('fieldHint.hatch-set')}>
          <Input id="hatch-set" type="number" min={0} {...form.register('eggsSet', { valueAsNumber: true })}  placeholder={t('fieldPh.hatch-set')}/>
        </Field>
        <Field id="hatch-live" label={t('hatch.liveChicks')} error={text(t, form.formState.errors.liveChicks?.message)} hint={t('fieldHint.hatch-live')}>
          <Input id="hatch-live" type="number" min={0} {...form.register('liveChicks', { valueAsNumber: true })}  placeholder={t('fieldPh.hatch-live')}/>
        </Field>
        <Field id="hatch-losses" label={t('hatch.losses')} hint={t('fieldHint.hatch-losses')}>
          <Input id="hatch-losses" type="number" min={0} {...form.register('losses', { valueAsNumber: true })}  placeholder={t('fieldPh.hatch-losses')}/>
        </Field>
        <Field id="hatch-other" label={t('hatch.other')} hint={t('fieldHint.hatch-other')}>
          <Input id="hatch-other" type="number" min={0} {...form.register('otherCount', { valueAsNumber: true })}  placeholder={t('fieldPh.hatch-other')}/>
        </Field>
        <Field id="hatch-note" label={t('hatch.difference')} hint={t('hatch.differenceHint')} error={text(t, form.formState.errors.differenceNote?.message)}>
          <TextArea id="hatch-note" {...form.register('differenceNote')}  placeholder={t('fieldPh.hatch-note')}/>
        </Field>
        {live > 0 ? (
          <>
            <Field id="hatch-code" label={t('batches.code')} error={text(t, form.formState.errors.batchCode?.message)} hint={t('fieldHint.hatch-code')}>
              <Input id="hatch-code" {...form.register('batchCode')}  placeholder={t('fieldPh.hatch-code')}/>
            </Field>
            <Field id="hatch-type" label={t('batches.birdType')} error={text(t, form.formState.errors.birdTypeId?.message)} hint={t('fieldHint.hatch-type')}>
              <select id="hatch-type" className={selectClass} {...form.register('birdTypeId')}>
                <option value="">{t('hatch.chooseType')}</option>
                {(types.data ?? []).filter((item) => item.status === 'active').map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field id="hatch-shed" label={t('batches.shed')} error={text(t, form.formState.errors.shedId?.message)} hint={t('fieldHint.hatch-shed')}>
              <select id="hatch-shed" className={selectClass} {...form.register('shedId')}>
                <option value="">{t('hatch.chooseShed')}</option>
                {(sheds.data ?? []).filter((item) => item.status === 'active').map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.code} · {item.name}
                  </option>
                ))}
              </select>
            </Field>
          </>
        ) : null}
        {rate ? (
          <p className="text-sm">
            {t('hatch.proposed', { formula: rate.formula, percent: rate.percent === null ? '—' : String(rate.percent) })}
          </p>
        ) : null}
        {mutation.isError ? <Alert>{explain(mutation.error, t)}</Alert> : null}
        <Button type="submit" disabled={mutation.isPending}>
          {t('hatch.save')}
        </Button>
      </form>
    </Card>
  );
}

function CandlingForm({ farmId, sittingId, onDone }: { farmId: string; sittingId: string; onDone: () => void }) {
  const { t } = useTranslation();
  const today = localToday();
  const [lines, setLines] = useState([{ label: '', eggCount: '' }]);
  const [observedOn, setObservedOn] = useState(today);
  const [notes, setNotes] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const mutation = useMutation({
    mutationFn: (values: z.infer<typeof candlingInputSchema>) =>
      api(`/api/v1/farms/${farmId}/incubation/${sittingId}/candling`, { method: 'POST', json: values }),
    onSuccess: () => {
      setLines([{ label: '', eggCount: '' }]);
      setNotes('');
      onDone();
    },
  });
  function submit(event: FormEvent) {
    event.preventDefault();
    const parsedLines = lines.map((line) => ({ label: line.label.trim(), eggCount: Number(line.eggCount || 0) }));
    const inspectedCount = parsedLines.reduce((sum, line) => sum + (Number.isFinite(line.eggCount) ? line.eggCount : 0), 0);
    const parsed = candlingInputSchema.safeParse({ observedOn, inspectedCount, notes, lines: parsedLines });
    if (!parsed.success) {
      setFieldError(text(t, parsed.error.issues[0]?.message) ?? t('validation.invalid'));
      return;
    }
    setFieldError(null);
    mutation.mutate(parsed.data);
  }
  return (
    <Card>
      <form className="grid gap-3" noValidate onSubmit={submit}>
        <h2 className="font-display text-2xl">{t('incubation.recordCandling')}</h2>
        <p className="text-sm text-ink-soft">{t('incubation.candlingHint')}</p>
        <Field id="candle-date" label={t('incubators.date')} hint={t('fieldHint.candle-date')}>
          <Input id="candle-date" type="date" value={observedOn} onChange={(event) => setObservedOn(event.target.value)} />
        </Field>
        {lines.map((line, index) => (
          <div key={index} className="grid gap-3 sm:grid-cols-2">
            <Field id={`candle-label-${index}`} label={t('incubation.outcome')} hint={t('fieldHint.candle-label')}>
              <Input
                id={`candle-label-${index}`}
                value={line.label}
                placeholder={t('fieldPh.candle-label')}
                onChange={(event) => setLines((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, label: event.target.value } : item)))}
              />
            </Field>
            <Field id={`candle-count-${index}`} label={t('incubation.eggCount')} hint={t('fieldHint.candle-count')}>
              <Input
                id={`candle-count-${index}`}
                type="number"
                min={0}
                value={line.eggCount}
                placeholder={t('fieldPh.candle-count')}
                onChange={(event) => setLines((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, eggCount: event.target.value } : item)))}
              />
            </Field>
          </div>
        ))}
        <Button type="button" variant="outline" onClick={() => setLines((current) => [...current, { label: '', eggCount: '' }])}>
          {t('incubation.addLine')}
        </Button>
        <Field id="candle-notes" label={`${t('incubators.notes')} (${t('common.optional')})`} hint={t('fieldHint.candle-notes')}>
          <TextArea id="candle-notes" value={notes} placeholder={t('fieldPh.candle-notes')} onChange={(event) => setNotes(event.target.value)} />
        </Field>
        {fieldError ? <Alert>{fieldError}</Alert> : null}
        {mutation.isError ? <Alert>{explain(mutation.error, t)}</Alert> : null}
        <Button type="submit" disabled={mutation.isPending}>
          {t('incubation.saveCandling')}
        </Button>
      </form>
    </Card>
  );
}
