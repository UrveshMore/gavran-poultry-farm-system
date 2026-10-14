import { eggCategoryInputSchema, eggCollectionInputSchema } from '@gavran/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { z } from 'zod';
import { ScreenTour } from '@/components/Tour';
import { Alert, Button, Card, Field, Input, TextArea } from '@/components/ui';
import { ApiError, api, errorKey } from '@/lib/api';
import { postOrQueue } from '@/lib/offlineQueue';
import type { Batch, EggCategory, EggCollection, FarmSummary, Shed } from '@/lib/types';
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

export function EggsPage() {
  const { farmId = '' } = useParams();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const farms = useQuery({ queryKey: ['farms'], queryFn: () => api<FarmSummary[]>('/api/v1/farms') });
  const access = farms.data?.find((farm) => farm.id === farmId);
  const categories = useQuery({
    queryKey: ['egg-categories', farmId],
    queryFn: () => api<EggCategory[]>(`/api/v1/farms/${farmId}/egg-categories`),
  });
  const collections = useQuery({
    queryKey: ['eggs', farmId],
    queryFn: () => api<EggCollection[]>(`/api/v1/farms/${farmId}/eggs`),
  });
  const canRecord = Boolean(access?.permissions.includes('egg.record'));
  const active = (categories.data ?? []).filter((item) => item.status === 'active');

  if (categories.isLoading || collections.isLoading || farms.isLoading) return <p>{t('common.loading')}</p>;
  if (categories.isError || !categories.data) return <Alert>{explain(categories.error, t)}</Alert>;
  if (collections.isError || !collections.data) return <Alert>{explain(collections.error, t)}</Alert>;

  return (
    <div className="grid gap-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 data-tour="screen-title" className="font-display text-3xl font-semibold">{t('eggs.title')}</h1>
          <p data-tour="screen-body" className="mt-1 text-ink-soft">{t('eggs.body')}</p>
          <ScreenTour screen="eggs" />
        </div>
        {canRecord && active.length > 0 ? (
          <Button data-tour="screen-action" data-add="eggs" type="button" className="min-h-14" onClick={() => setOpen((value) => !value)}>
            {open ? t('eggs.hideForm') : t('eggs.record')}
          </Button>
        ) : null}
      </div>
      <p className="rounded-xl bg-gold/30 px-3 py-2 text-sm">{t('eggs.noPrice')}</p>
      {canRecord ? (
        <SortTools
          farmId={farmId}
          categories={categories.data}
          onDone={() => void queryClient.invalidateQueries({ queryKey: ['egg-categories', farmId] })}
        />
      ) : null}
      {open && canRecord ? (
        <CollectionForm
          farmId={farmId}
          categories={active}
          onDone={() => {
            setOpen(false);
            void queryClient.invalidateQueries({ queryKey: ['eggs', farmId] });
          }}
        />
      ) : null}
      {categories.data.length === 0 ? (
        <Card>
          <h2 className="font-display text-2xl">{t('eggs.emptyTitle')}</h2>
          <p className="text-ink-soft">{t('eggs.emptyBody')}</p>
        </Card>
      ) : null}
      {collections.data.length === 0 ? (
        <Card>
          <h2 className="font-display text-2xl">{t('eggs.emptyCollections')}</h2>
          <p className="text-ink-soft">{t('eggs.emptyCollectionsBody')}</p>
          {canRecord && active.length > 0 ? (
            <Button type="button" className="mt-3 min-h-14" data-add="eggs" onClick={() => setOpen(true)}>
              {t('eggs.record')}
            </Button>
          ) : null}
        </Card>
      ) : (
        <div className="grid gap-3">
          {collections.data.map((item) => (
            <Card key={item.id}>
              <p className="text-sm font-semibold text-ink-soft">{item.collectedOn}</p>
              <h2 className="font-display text-2xl">{t('eggs.total', { count: item.total })}</h2>
              <ul className="mt-2 grid gap-1 text-sm">
                {item.lines.map((line) => (
                  <li key={line.categoryId}>
                    {line.categoryName}: {line.eggCount}
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-sm text-ink-soft">
                {[item.batchCode, item.shedCode, item.shiftLabel].filter(Boolean).join(' · ') || t('eggs.backyardShort')}
              </p>
              {item.notes ? <p className="mt-1 text-sm">{item.notes}</p> : null}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function SortTools({ farmId, categories, onDone }: { farmId: string; categories: EggCategory[]; onDone: () => void }) {
  const { t } = useTranslation();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const form = useForm<z.infer<typeof eggCategoryInputSchema>>({
    resolver: zodResolver(eggCategoryInputSchema),
    defaultValues: { name: '' },
  });
  const mutation = useMutation({
    mutationFn: (values: z.infer<typeof eggCategoryInputSchema>) =>
      api(`/api/v1/farms/${farmId}/egg-categories`, { method: 'POST', json: values }),
    onSuccess: () => {
      form.reset();
      onDone();
    },
  });

  async function addNamedSorts() {
    setError(null);
    setPending(true);
    try {
      const names = [t('eggs.sort.fertile'), t('eggs.sort.table')];
      for (const name of names) {
        if (categories.some((item) => item.name.localeCompare(name, undefined, { sensitivity: 'accent' }) === 0)) continue;
        await api(`/api/v1/farms/${farmId}/egg-categories`, { method: 'POST', json: { name } });
      }
      onDone();
    } catch (caught) {
      setError(explain(caught, t));
    } finally {
      setPending(false);
    }
  }

  return (
    <Card>
      <div className="grid gap-3">
        <Button type="button" variant="outline" disabled={pending} onClick={() => void addNamedSorts()}>
          {t('eggs.addSorts')}
        </Button>
        <form className="grid gap-3" onSubmit={form.handleSubmit((values) => mutation.mutate(values))} noValidate>
          <Field id="egg-sort" label={t('eggs.sortName')} error={text(t, form.formState.errors.name?.message)} hint={t('fieldHint.egg-sort')}>
            <Input id="egg-sort" {...form.register('name')}  placeholder={t('fieldPh.egg-sort')}/>
          </Field>
          {error ? <Alert>{error}</Alert> : null}
          {mutation.isError ? <Alert>{explain(mutation.error, t)}</Alert> : null}
          <Button type="submit" variant="outline" disabled={mutation.isPending}>
            {t('eggs.saveSort')}
          </Button>
        </form>
      </div>
    </Card>
  );
}

function CollectionForm({ farmId, categories, onDone }: { farmId: string; categories: EggCategory[]; onDone: () => void }) {
  const { t } = useTranslation();
  const today = localToday();
  const batches = useQuery({ queryKey: ['batches', farmId], queryFn: () => api<Batch[]>(`/api/v1/farms/${farmId}/batches`) });
  const sheds = useQuery({ queryKey: ['sheds', farmId], queryFn: () => api<Shed[]>(`/api/v1/farms/${farmId}/sheds`) });
  const [collectedOn, setCollectedOn] = useState(today);
  const [batchId, setBatchId] = useState('');
  const [shedId, setShedId] = useState('');
  const [shiftLabel, setShiftLabel] = useState('');
  const [notes, setNotes] = useState('');
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [fieldError, setFieldError] = useState<string | null>(null);
  const mutation = useMutation({
    mutationFn: (values: z.infer<typeof eggCollectionInputSchema>) => postOrQueue(farmId, `/api/v1/farms/${farmId}/eggs`, values),
    onSuccess: onDone,
  });
  const openBatches = (batches.data ?? []).filter((batch) => batch.status === 'open');

  function submit(event: FormEvent) {
    event.preventDefault();
    setFieldError(null);
    const lines = categories
      .map((category) => ({ categoryId: category.id, eggCount: Number(counts[category.id] || 0) }))
      .filter((line) => line.eggCount > 0);
    const parsed = eggCollectionInputSchema.safeParse({
      collectedOn,
      batchId,
      shedId,
      shiftLabel,
      notes,
      lines: lines.length > 0 ? lines : [{ categoryId: categories[0]?.id ?? '', eggCount: 0 }],
    });
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      setFieldError(text(t, issue?.message) ?? t('validation.invalid'));
      return;
    }
    mutation.mutate(parsed.data);
  }

  return (
    <Card>
      <form className="grid gap-3" onSubmit={submit} noValidate>
        <p className="text-sm text-ink-soft">{t('eggs.backyard')}</p>
        <Field id="egg-date" label={t('eggs.date')} hint={t('fieldHint.egg-date')}>
          <Input id="egg-date" type="date" value={collectedOn} onChange={(event) => setCollectedOn(event.target.value)} />
        </Field>
        <Field id="egg-batch" label={`${t('eggs.batch')} (${t('common.optional')})`} hint={t('fieldHint.egg-batch')}>
          <select id="egg-batch" className={selectClass} value={batchId} onChange={(event) => setBatchId(event.target.value)}>
            <option value="">{t('eggs.batchNone')}</option>
            {openBatches.map((batch) => (
              <option key={batch.id} value={batch.id}>
                {batch.code} · {batch.birdTypeName}
              </option>
            ))}
          </select>
        </Field>
        <Field id="egg-shed" label={`${t('eggs.shed')} (${t('common.optional')})`} hint={t('fieldHint.egg-shed')}>
          <select id="egg-shed" className={selectClass} value={shedId} onChange={(event) => setShedId(event.target.value)}>
            <option value="">{t('eggs.shedNone')}</option>
            {(sheds.data ?? []).map((shed) => (
              <option key={shed.id} value={shed.id}>
                {shed.code} · {shed.name}
              </option>
            ))}
          </select>
        </Field>
        <Field id="egg-shift" label={`${t('eggs.shift')} (${t('common.optional')})`} hint={t('fieldHint.egg-shift')}>
          <Input id="egg-shift" value={shiftLabel} maxLength={40} placeholder={t('fieldPh.egg-shift')} onChange={(event) => setShiftLabel(event.target.value)} />
        </Field>
        {categories.map((category) => (
          <Field key={category.id} id={`egg-count-${category.id}`} label={category.name} hint={t('fieldHint.egg-count')}>
            <Input
              id={`egg-count-${category.id}`}
              type="number"
              min={0}
              inputMode="numeric"
              value={counts[category.id] ?? ''}
              placeholder={t('fieldPh.egg-count')}
              onChange={(event) => setCounts((current) => ({ ...current, [category.id]: event.target.value }))}
            />
          </Field>
        ))}
        <Field id="egg-notes" label={`${t('eggs.notes')} (${t('common.optional')})`} hint={t('fieldHint.egg-notes')}>
          <TextArea id="egg-notes" value={notes} maxLength={500} placeholder={t('fieldPh.egg-notes')} onChange={(event) => setNotes(event.target.value)} />
        </Field>
        {fieldError ? <Alert>{fieldError}</Alert> : null}
        {mutation.isError ? <Alert>{explain(mutation.error, t)}</Alert> : null}
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? t('eggs.saving') : t('eggs.save')}
        </Button>
      </form>
    </Card>
  );
}
