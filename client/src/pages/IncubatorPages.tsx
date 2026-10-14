import { incubatorInputSchema, incubatorMaintenanceInputSchema, incubatorReadingInputSchema } from '@gavran/shared';
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
import type { FarmSummary, Incubator, IncubatorMaintenance, IncubatorReading } from '@/lib/types';
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

function applyFields(error: unknown, setError: (name: 'code' | 'name' | 'notes', err: { message: string }) => void) {
  if (!(error instanceof ApiError) || !error.details?.fields) return;
  for (const [key, code] of Object.entries(error.details.fields)) {
    if (key === 'code' || key === 'name' || key === 'notes') setError(key, { message: code });
  }
}

const selectClass = 'min-h-11 w-full rounded-xl border border-line bg-white px-3';

export function IncubatorsPage() {
  const { farmId = '' } = useParams();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const farms = useQuery({ queryKey: ['farms'], queryFn: () => api<FarmSummary[]>('/api/v1/farms') });
  const access = farms.data?.find((farm) => farm.id === farmId);
  const incubators = useQuery({ queryKey: ['incubators', farmId], queryFn: () => api<Incubator[]>(`/api/v1/farms/${farmId}/incubators`) });
  const canManage = Boolean(access?.permissions.includes('incubator.manage'));

  if (incubators.isLoading || farms.isLoading) return <p>{t('common.loading')}</p>;
  if (incubators.isError || !incubators.data) return <Alert>{explain(incubators.error, t)}</Alert>;

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 data-tour="screen-title" className="font-display text-3xl font-semibold">{t('incubators.title')}</h1>
          <p data-tour="screen-body" className="mt-1 text-ink-soft">{t('incubators.body')}</p>
          <ScreenTour screen="incubators" />
        </div>
        {canManage ? (
          <Button data-tour="screen-action" data-add="incubators" type="button" className="min-h-14" onClick={() => setOpen((value) => !value)}>
            {open ? t('incubators.hideForm') : t('incubators.add')}
          </Button>
        ) : null}
      </div>
      <p className="rounded-xl bg-gold/30 px-3 py-2 text-sm">{t('incubators.noSetpoint')}</p>
      {open && canManage ? (
        <IncubatorForm
          farmId={farmId}
          onDone={() => {
            setOpen(false);
            void queryClient.invalidateQueries({ queryKey: ['incubators', farmId] });
          }}
        />
      ) : null}
      {incubators.data.length === 0 ? (
        <Card>
          <h2 className="font-display text-2xl">{t('incubators.emptyTitle')}</h2>
          <p className="text-ink-soft">{t('incubators.emptyBody')}</p>
          {canManage ? (
            <Button type="button" className="mt-3 min-h-14" data-add="incubators" onClick={() => setOpen(true)}>
              {t('incubators.add')}
            </Button>
          ) : null}
        </Card>
      ) : (
        <div className="grid gap-3">
          {incubators.data.map((item) => (
            <Card key={item.id}>
              <p className="text-sm font-semibold text-ink-soft">{item.code}</p>
              <h2 className="font-display text-2xl">{item.name}</h2>
              <p className="text-sm">
                {t(`incubators.status.${item.status}`)}
                {item.capacityEggs === null ? '' : ` · ${t('incubators.capacityEggs', { count: item.capacityEggs })}`}
              </p>
              <Button asChild className="mt-3" variant="outline">
                <Link to={`/farms/${farmId}/incubators/${item.id}`}>{t('incubators.open')}</Link>
              </Button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function IncubatorForm({ farmId, onDone }: { farmId: string; onDone: () => void }) {
  const { t } = useTranslation();
  const form = useForm<z.infer<typeof incubatorInputSchema>>({
    resolver: zodResolver(incubatorInputSchema),
    defaultValues: { code: '', name: '', capacityEggs: null, notes: '' },
  });
  const mutation = useMutation({
    mutationFn: (values: z.infer<typeof incubatorInputSchema>) => api(`/api/v1/farms/${farmId}/incubators`, { method: 'POST', json: values }),
    onSuccess: onDone,
    onError: (error) => applyFields(error, (name, err) => form.setError(name, err)),
  });
  const errors = form.formState.errors;
  return (
    <Card>
      <form
        className="grid gap-3"
        noValidate
        onSubmit={form.handleSubmit((values) => {
          const raw = form.getValues('capacityEggs');
          mutation.mutate({ ...values, capacityEggs: raw === null || Number.isNaN(raw) ? null : raw });
        })}
      >
        <Field id="inc-code" label={t('incubators.code')} error={text(t, errors.code?.message)} hint={t('fieldHint.inc-code')}>
          <Input id="inc-code" {...form.register('code')}  placeholder={t('fieldPh.inc-code')}/>
        </Field>
        <Field id="inc-name" label={t('incubators.name')} error={text(t, errors.name?.message)} hint={t('fieldHint.inc-name')}>
          <Input id="inc-name" {...form.register('name')}  placeholder={t('fieldPh.inc-name')}/>
        </Field>
        <Field id="inc-capacity" label={`${t('incubators.capacity')} (${t('common.optional')})`} hint={t('incubators.capacityHint')} error={text(t, errors.capacityEggs?.message)}>
          <Input
            id="inc-capacity"
            type="number"
            min={0}
            {...form.register('capacityEggs', { setValueAs: (value) => (value === '' || value === null ? null : Number(value)) })}
          />
        </Field>
        <Field id="inc-notes" label={`${t('incubators.notes')} (${t('common.optional')})`} error={text(t, errors.notes?.message)} hint={t('fieldHint.inc-notes')}>
          <TextArea id="inc-notes" {...form.register('notes')}  placeholder={t('fieldPh.inc-notes')}/>
        </Field>
        {mutation.isError ? <Alert>{explain(mutation.error, t)}</Alert> : null}
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? t('incubators.saving') : t('incubators.save')}
        </Button>
      </form>
    </Card>
  );
}

export function IncubatorDetailPage() {
  const { farmId = '', incubatorId = '' } = useParams();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const farms = useQuery({ queryKey: ['farms'], queryFn: () => api<FarmSummary[]>('/api/v1/farms') });
  const access = farms.data?.find((farm) => farm.id === farmId);
  const detail = useQuery({
    queryKey: ['incubator', farmId, incubatorId],
    queryFn: () =>
      api<{ incubator: Incubator; readings: IncubatorReading[]; maintenance: IncubatorMaintenance[] }>(
        `/api/v1/farms/${farmId}/incubators/${incubatorId}`,
      ),
  });
  if (detail.isLoading) return <p>{t('common.loading')}</p>;
  if (detail.isError || !detail.data) return <Alert>{explain(detail.error, t)}</Alert>;
  const { incubator, readings, maintenance } = detail.data;
  const canRecord = Boolean(access?.permissions.includes('incubator.record'));
  const canManage = Boolean(access?.permissions.includes('incubator.manage'));
  return (
    <div className="grid gap-4">
      <div>
        <p className="text-sm font-semibold text-ink-soft">{incubator.code}</p>
        <h1 className="font-display text-3xl font-semibold">{incubator.name}</h1>
        <p className="mt-1 text-ink-soft">{t(`incubators.status.${incubator.status}`)}</p>
        {incubator.notes ? <p className="mt-2 text-sm">{incubator.notes}</p> : null}
      </div>
      <p className="rounded-xl bg-gold/30 px-3 py-2 text-sm">{t('incubators.noSetpoint')}</p>
      {canRecord ? (
        <ReadingForm
          farmId={farmId}
          incubatorId={incubatorId}
          onDone={() => void queryClient.invalidateQueries({ queryKey: ['incubator', farmId, incubatorId] })}
        />
      ) : null}
      {canManage ? (
        <MaintenanceForm
          farmId={farmId}
          incubatorId={incubatorId}
          onDone={() => void queryClient.invalidateQueries({ queryKey: ['incubator', farmId, incubatorId] })}
        />
      ) : null}
      <Card>
        <h2 className="font-display text-2xl">{t('incubators.readings')}</h2>
        {readings.length === 0 ? (
          <p className="mt-1 text-ink-soft">{t('incubators.noReadings')}</p>
        ) : (
          <ul className="mt-2 grid gap-2 text-sm">
            {readings.map((reading) => (
              <li key={reading.id}>
                {reading.recordedOn}
                {reading.recordedTime ? ` ${reading.recordedTime}` : ''} · {t(`incubators.power.${reading.powerStatus}`)} ·{' '}
                {t(`incubators.source.${reading.source}`)}
                <br />
                {t('incubators.temperature')}: {reading.temperatureValue === null ? t('incubators.notEntered') : `${reading.temperatureValue} ${reading.temperatureUnit ?? ''}`}
                {' · '}
                {t('incubators.humidity')}: {reading.humidityValue === null ? t('incubators.notEntered') : `${reading.humidityValue} ${reading.humidityUnit ?? ''}`}
                {reading.notes ? <span className="block text-ink-soft">{reading.notes}</span> : null}
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card>
        <h2 className="font-display text-2xl">{t('incubators.maintenance')}</h2>
        {maintenance.length === 0 ? (
          <p className="mt-1 text-ink-soft">{t('incubators.noMaintenance')}</p>
        ) : (
          <ul className="mt-2 grid gap-1 text-sm">
            {maintenance.map((item) => (
              <li key={item.id}>
                {item.occurredOn} · {t(`incubators.status.${item.status}`)}
                {item.notes ? ` · ${item.notes}` : ''}
              </li>
            ))}
          </ul>
        )}
      </Card>
      {readings.some((reading) => reading.source === 'sensor') ? <p className="text-sm text-ink-soft">{t('incubators.sensorNote')}</p> : null}
    </div>
  );
}

function ReadingForm({ farmId, incubatorId, onDone }: { farmId: string; incubatorId: string; onDone: () => void }) {
  const { t } = useTranslation();
  const today = localToday();
  const form = useForm<z.infer<typeof incubatorReadingInputSchema>>({
    resolver: zodResolver(incubatorReadingInputSchema),
    defaultValues: {
      recordedOn: today,
      recordedTime: '',
      temperature: { value: null, unit: '' },
      humidity: { value: null, unit: '' },
      powerStatus: 'unknown',
      source: 'manual',
      notes: '',
    },
  });
  const mutation = useMutation({
    mutationFn: (values: z.infer<typeof incubatorReadingInputSchema>) =>
      api(`/api/v1/farms/${farmId}/incubators/${incubatorId}/readings`, { method: 'POST', json: values }),
    onSuccess: () => {
      form.reset({
        recordedOn: today,
        recordedTime: '',
        temperature: { value: null, unit: '' },
        humidity: { value: null, unit: '' },
        powerStatus: 'unknown',
        source: 'manual',
        notes: '',
      });
      onDone();
    },
  });
  return (
    <Card>
      <form className="grid gap-3" noValidate onSubmit={form.handleSubmit((values) => mutation.mutate(values))}>
        <h2 className="font-display text-2xl">{t('incubators.reading')}</h2>
        <Field id="read-date" label={t('incubators.date')} error={text(t, form.formState.errors.recordedOn?.message)} hint={t('fieldHint.read-date')}>
          <Input id="read-date" type="date" {...form.register('recordedOn')} />
        </Field>
        <Field id="read-time" label={`${t('incubators.time')} (${t('common.optional')})`} error={text(t, form.formState.errors.recordedTime?.message)} hint={t('fieldHint.read-time')}>
          <Input id="read-time" type="time" {...form.register('recordedTime')} />
        </Field>
        <MeasureFields form={form} name="temperature" label={t('incubators.temperature')} />
        <MeasureFields form={form} name="humidity" label={t('incubators.humidity')} />
        <Field id="read-power" label={t('incubators.powerLabel')} hint={t('fieldHint.read-power')}>
          <select id="read-power" className={selectClass} {...form.register('powerStatus')}>
            {(['unknown', 'on', 'off'] as const).map((item) => (
              <option key={item} value={item}>
                {t(`incubators.power.${item}`)}
              </option>
            ))}
          </select>
        </Field>
        <Field id="read-source" label={t('incubators.sourceLabel')} hint={t('fieldHint.read-source')}>
          <select id="read-source" className={selectClass} {...form.register('source')}>
            {(['manual', 'sensor'] as const).map((item) => (
              <option key={item} value={item}>
                {t(`incubators.source.${item}`)}
              </option>
            ))}
          </select>
        </Field>
        <Field id="read-notes" label={`${t('incubators.notes')} (${t('common.optional')})`} hint={t('fieldHint.read-notes')}>
          <TextArea id="read-notes" {...form.register('notes')}  placeholder={t('fieldPh.read-notes')}/>
        </Field>
        {mutation.isError ? <Alert>{explain(mutation.error, t)}</Alert> : null}
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? t('incubators.saving') : t('incubators.saveReading')}
        </Button>
      </form>
    </Card>
  );
}

function MeasureFields({
  form,
  name,
  label,
}: {
  form: ReturnType<typeof useForm<z.infer<typeof incubatorReadingInputSchema>>>;
  name: 'temperature' | 'humidity';
  label: string;
}) {
  const { t } = useTranslation();
  const valueError = form.formState.errors[name]?.value?.message;
  const unitError = form.formState.errors[name]?.unit?.message;
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field id={`${name}-value`} label={`${label} (${t('common.optional')})`} error={text(t, valueError)} hint={t('fieldHint.reading-value')}>
        <Input
          id={`${name}-value`}
          type="number"
          step="0.01"
          placeholder={t('fieldPh.reading-value')}
          {...form.register(`${name}.value`, { setValueAs: (value) => (value === '' || value === null ? null : Number(value)) })}
        />
      </Field>
      <Field id={`${name}-unit`} label={t('incubators.unit')} error={text(t, unitError)} hint={t('fieldHint.reading-unit')}>
        <Input id={`${name}-unit`} {...form.register(`${name}.unit`)}  placeholder={t('fieldPh.reading-unit')}/>
      </Field>
    </div>
  );
}

function MaintenanceForm({ farmId, incubatorId, onDone }: { farmId: string; incubatorId: string; onDone: () => void }) {
  const { t } = useTranslation();
  const today = localToday();
  const form = useForm<z.infer<typeof incubatorMaintenanceInputSchema>>({
    resolver: zodResolver(incubatorMaintenanceInputSchema),
    defaultValues: { occurredOn: today, status: 'out_of_service', notes: '' },
  });
  const mutation = useMutation({
    mutationFn: (values: z.infer<typeof incubatorMaintenanceInputSchema>) =>
      api(`/api/v1/farms/${farmId}/incubators/${incubatorId}/maintenance`, { method: 'POST', json: values }),
    onSuccess: onDone,
  });
  return (
    <Card>
      <form className="grid gap-3" noValidate onSubmit={form.handleSubmit((values) => mutation.mutate(values))}>
        <h2 className="font-display text-2xl">{t('incubators.maintenance')}</h2>
        <Field id="maint-date" label={t('incubators.date')} hint={t('fieldHint.maint-date')}>
          <Input id="maint-date" type="date" {...form.register('occurredOn')} />
        </Field>
        <Field id="maint-status" label={t('incubators.statusLabel')} hint={t('fieldHint.maint-status')}>
          <select id="maint-status" className={selectClass} {...form.register('status')}>
            <option value="out_of_service">{t('incubators.status.out_of_service')}</option>
            <option value="in_service">{t('incubators.status.in_service')}</option>
          </select>
        </Field>
        <Field id="maint-notes" label={`${t('incubators.notes')} (${t('common.optional')})`} hint={t('fieldHint.maint-notes')}>
          <TextArea id="maint-notes" {...form.register('notes')}  placeholder={t('fieldPh.maint-notes')}/>
        </Field>
        {mutation.isError ? <Alert>{explain(mutation.error, t)}</Alert> : null}
        <Button type="submit" variant="outline" disabled={mutation.isPending}>
          {t('incubators.saveMaintenance')}
        </Button>
      </form>
    </Card>
  );
}
