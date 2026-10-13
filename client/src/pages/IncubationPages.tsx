import { candlingInputSchema, incubationInputSchema } from '@gavran/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import { z } from 'zod';
import { Alert, Button, Card, Field, Input, TextArea } from '@/components/ui';
import { ApiError, api, errorKey } from '@/lib/api';
import type { CandlingRecord, FarmSummary, Incubator, Sitting } from '@/lib/types';

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
  const today = new Date().toISOString().slice(0, 10);
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
        <Field id="sit-code" label={t('incubation.code')} error={text(t, form.formState.errors.code?.message)}>
          <Input id="sit-code" {...form.register('code')} />
        </Field>
        <Field id="sit-mode" label={t('incubation.where')}>
          <select id="sit-mode" className={selectClass} {...form.register('mode')}>
            <option value="broody_hen">{t('incubation.mode.broody_hen')}</option>
            <option value="incubator">{t('incubation.mode.incubator')}</option>
          </select>
        </Field>
        {mode === 'broody_hen' ? (
          <Field id="sit-hen" label={t('incubation.hen')} error={text(t, form.formState.errors.henName?.message)}>
            <Input id="sit-hen" {...form.register('henName')} />
          </Field>
        ) : (
          <Field id="sit-machine" label={t('incubation.machine')} error={text(t, form.formState.errors.incubatorId?.message)}>
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
        <Field id="sit-date" label={t('incubation.started')} error={text(t, form.formState.errors.startedOn?.message)}>
          <Input id="sit-date" type="date" {...form.register('startedOn')} />
        </Field>
        <Field id="sit-count" label={t('incubation.eggCount')} error={text(t, form.formState.errors.eggCount?.message)}>
          <Input id="sit-count" type="number" min={1} {...form.register('eggCount', { valueAsNumber: true })} />
        </Field>
        <Field id="sit-notes" label={`${t('incubators.notes')} (${t('common.optional')})`}>
          <TextArea id="sit-notes" {...form.register('notes')} />
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
    queryFn: () => api<{ sitting: Sitting; candling: CandlingRecord[] }>(`/api/v1/farms/${farmId}/incubation/${sittingId}`),
  });
  if (detail.isLoading) return <p>{t('common.loading')}</p>;
  if (detail.isError || !detail.data) return <Alert>{explain(detail.error, t)}</Alert>;
  const { sitting, candling } = detail.data;
  const canRecord = Boolean(access?.permissions.includes('incubation.record') && sitting.status === 'open');
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

function CandlingForm({ farmId, sittingId, onDone }: { farmId: string; sittingId: string; onDone: () => void }) {
  const { t } = useTranslation();
  const today = new Date().toISOString().slice(0, 10);
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
        <Field id="candle-date" label={t('incubators.date')}>
          <Input id="candle-date" type="date" value={observedOn} onChange={(event) => setObservedOn(event.target.value)} />
        </Field>
        {lines.map((line, index) => (
          <div key={index} className="grid gap-3 sm:grid-cols-2">
            <Field id={`candle-label-${index}`} label={t('incubation.outcome')}>
              <Input
                id={`candle-label-${index}`}
                value={line.label}
                onChange={(event) => setLines((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, label: event.target.value } : item)))}
              />
            </Field>
            <Field id={`candle-count-${index}`} label={t('incubation.eggCount')}>
              <Input
                id={`candle-count-${index}`}
                type="number"
                min={0}
                value={line.eggCount}
                onChange={(event) => setLines((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, eggCount: event.target.value } : item)))}
              />
            </Field>
          </div>
        ))}
        <Button type="button" variant="outline" onClick={() => setLines((current) => [...current, { label: '', eggCount: '' }])}>
          {t('incubation.addLine')}
        </Button>
        <Field id="candle-notes" label={`${t('incubators.notes')} (${t('common.optional')})`}>
          <TextArea id="candle-notes" value={notes} onChange={(event) => setNotes(event.target.value)} />
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
