import { parentageInputSchema } from '@gavran/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { z } from 'zod';
import { JumpAdd } from '@/components/JumpAdd';
import { Alert, Button, Card, Field, Input, TextArea } from '@/components/ui';
import { ApiError, api, errorKey } from '@/lib/api';
import type { Batch, FarmSummary, ParentagePage } from '@/lib/types';
import { localToday } from '@/lib/today';

const selectClass = 'min-h-11 w-full rounded-xl border border-line bg-white px-3';

function explain(error: unknown, t: (key: string) => string) {
  if (error instanceof ApiError) {
    if (error.status === 403) return t('common.permissionDenied');
    if (error.status === 404) return t('farm.notFound');
    const key = errorKey(error);
    return key ? t(key) : t('common.errorGeneric');
  }
  return t('common.errorGeneric');
}

export function ParentagePageView() {
  const { farmId = '' } = useParams();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const farms = useQuery({ queryKey: ['farms'], queryFn: () => api<FarmSummary[]>('/api/v1/farms') });
  const access = farms.data?.find((farm) => farm.id === farmId);
  const page = useQuery({ queryKey: ['parentage', farmId], queryFn: () => api<ParentagePage>(`/api/v1/farms/${farmId}/parentage`) });
  const batches = useQuery({ queryKey: ['batches', farmId], queryFn: () => api<Batch[]>(`/api/v1/farms/${farmId}/batches`) });
  const canRecord = Boolean(access?.permissions.includes('breeding.record'));
  const form = useForm<z.infer<typeof parentageInputSchema>>({
    resolver: zodResolver(parentageInputSchema),
    defaultValues: { recordedOn: localToday(), offspringBatchId: '', sireNote: '', damNote: '', sireBatchId: '', damBatchId: '', note: '' },
  });
  const mutation = useMutation({
    mutationFn: (values: z.infer<typeof parentageInputSchema>) => api(`/api/v1/farms/${farmId}/parentage`, { method: 'POST', json: values }),
    onSuccess: () => {
      form.reset({ recordedOn: localToday(), offspringBatchId: '', sireNote: '', damNote: '', sireBatchId: '', damBatchId: '', note: '' });
      void queryClient.invalidateQueries({ queryKey: ['parentage', farmId] });
    },
  });

  if (page.isLoading || farms.isLoading) return <p>{t('common.loading')}</p>;
  if (page.isError || !page.data) return <Alert>{explain(page.error, t)}</Alert>;

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold">{t('parentage.title')}</h1>
          <p className="mt-1 text-ink-soft">{t('parentage.body')}</p>
        </div>
        {canRecord ? <JumpAdd add="parentage" target="create-parentage">{t('parentage.add')}</JumpAdd> : null}
      </div>
      <p className="rounded-xl bg-gold/30 px-3 py-2 text-sm">{t('parentage.noRule')}</p>
      {page.data.records.length === 0 ? (
        <Card>
          <h2 className="font-display text-2xl">{t('parentage.emptyTitle')}</h2>
          <p className="text-ink-soft">{t('parentage.emptyBody')}</p>
          {canRecord ? <JumpAdd add="parentage" target="create-parentage">{t('parentage.add')}</JumpAdd> : null}
        </Card>
      ) : (
        page.data.records.map((row) => (
          <Card key={row.id}>
            <p className="font-semibold">{row.recordedOn}</p>
            <p>{t('parentage.sireLine', { text: row.sireNote || row.sireCode || t('parentage.blank') })}</p>
            <p>{t('parentage.damLine', { text: row.damNote || row.damCode || t('parentage.blank') })}</p>
            {row.offspringCode ? <p className="text-sm text-ink-soft">{t('parentage.offspringLine', { code: row.offspringCode })}</p> : null}
            {row.note ? <p>{row.note}</p> : null}
          </Card>
        ))
      )}
      {canRecord ? (
        <Card>
          <div id="create-parentage" />
          <form className="grid gap-3" onSubmit={form.handleSubmit((values) => mutation.mutate(values))}>
            <h2 className="font-display text-2xl">{t('parentage.add')}</h2>
            <Field id="par-date" label={t('parentage.date')} hint={t('fieldHint.par-date')}>
              <Input id="par-date" type="date" {...form.register('recordedOn')} />
            </Field>
            <Field id="par-offspring" label={`${t('parentage.offspring')} (${t('common.optional')})`} hint={t('fieldHint.par-offspring')}>
              <select id="par-offspring" className={selectClass} {...form.register('offspringBatchId')}>
                <option value="">{t('parentage.none')}</option>
                {(batches.data ?? []).map((batch) => (
                  <option key={batch.id} value={batch.id}>{batch.code}</option>
                ))}
              </select>
            </Field>
            <Field id="par-sire" label={t('parentage.sire')} hint={t('parentage.parentHint')}>
              <Input id="par-sire" {...form.register('sireNote')}  placeholder={t('fieldPh.par-sire')}/>
            </Field>
            <Field id="par-sire-batch" label={`${t('parentage.sireBatch')} (${t('common.optional')})`} hint={t('fieldHint.par-sire-batch')}>
              <select id="par-sire-batch" className={selectClass} {...form.register('sireBatchId')}>
                <option value="">{t('parentage.none')}</option>
                {(batches.data ?? []).map((batch) => (
                  <option key={batch.id} value={batch.id}>{batch.code}</option>
                ))}
              </select>
            </Field>
            <Field id="par-dam" label={t('parentage.dam')} hint={t('fieldHint.par-dam')}>
              <Input id="par-dam" {...form.register('damNote')}  placeholder={t('fieldPh.par-dam')}/>
            </Field>
            <Field id="par-dam-batch" label={`${t('parentage.damBatch')} (${t('common.optional')})`} hint={t('fieldHint.par-dam-batch')}>
              <select id="par-dam-batch" className={selectClass} {...form.register('damBatchId')}>
                <option value="">{t('parentage.none')}</option>
                {(batches.data ?? []).map((batch) => (
                  <option key={batch.id} value={batch.id}>{batch.code}</option>
                ))}
              </select>
            </Field>
            <Field id="par-note" label={`${t('parentage.note')} (${t('common.optional')})`} hint={t('fieldHint.par-note')}>
              <TextArea id="par-note" {...form.register('note')}  placeholder={t('fieldPh.par-note')}/>
            </Field>
            {mutation.isError ? <Alert>{explain(mutation.error, t)}</Alert> : null}
            <Button type="submit">{mutation.isPending ? t('parentage.saving') : t('parentage.save')}</Button>
          </form>
        </Card>
      ) : null}
    </div>
  );
}
