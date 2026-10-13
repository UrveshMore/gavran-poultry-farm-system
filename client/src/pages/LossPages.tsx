import { lossIncidentSchema } from '@gavran/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { z } from 'zod';
import { Alert, Button, Card, Field, Input, TextArea } from '@/components/ui';
import { ApiError, api, errorKey } from '@/lib/api';
import type { FarmSummary, LossPage } from '@/lib/types';

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

export function LossesPage() {
  const { farmId = '' } = useParams();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const farms = useQuery({ queryKey: ['farms'], queryFn: () => api<FarmSummary[]>('/api/v1/farms') });
  const access = farms.data?.find((farm) => farm.id === farmId);
  const losses = useQuery({ queryKey: ['losses', farmId], queryFn: () => api<LossPage>(`/api/v1/farms/${farmId}/losses`) });
  const canRecord = Boolean(access?.permissions.includes('loss.record'));
  const form = useForm<z.infer<typeof lossIncidentSchema>>({
    resolver: zodResolver(lossIncidentSchema),
    defaultValues: { occurredOn: '', birdCount: 0, note: '', movementId: '' },
  });
  const mutation = useMutation({
    mutationFn: (values: z.infer<typeof lossIncidentSchema>) => api(`/api/v1/farms/${farmId}/losses`, { method: 'POST', json: values }),
    onSuccess: () => {
      form.reset({ occurredOn: '', birdCount: 0, note: '', movementId: '' });
      void queryClient.invalidateQueries({ queryKey: ['losses', farmId] });
    },
  });

  if (losses.isLoading) return <p>{t('common.loading')}</p>;
  if (losses.isError || !losses.data) return <Alert>{explain(losses.error, t)}</Alert>;
  const page = losses.data;

  return (
    <div className="grid gap-4">
      <div>
        <h1 className="font-display text-3xl font-semibold">{t('losses.title')}</h1>
        <p className="mt-1 text-ink-soft">{t('losses.body')}</p>
      </div>
      <p className="rounded-xl bg-gold/30 px-3 py-2 text-sm">{t('losses.noRate')}</p>
      {page.incidents.length === 0 ? (
        <Card>
          <h2 className="font-display text-2xl">{t('losses.emptyTitle')}</h2>
          <p className="text-ink-soft">{t('losses.emptyBody')}</p>
        </Card>
      ) : (
        page.incidents.map((item) => (
          <Card key={item.id}>
            <p className="font-semibold">
              {item.occurredOn} · {t('losses.count', { count: item.birdCount })}
            </p>
            <p>{item.note}</p>
            {item.batchCode ? <p className="text-sm text-ink-soft">{t('losses.linked', { batch: item.batchCode })}</p> : null}
          </Card>
        ))
      )}
      {canRecord ? (
        <Card>
          <form className="grid gap-3" onSubmit={form.handleSubmit((values) => mutation.mutate({ ...values, birdCount: Number(values.birdCount) }))}>
            <h2 className="font-display text-2xl">{t('losses.add')}</h2>
            <Field id="loss-date" label={t('losses.date')}>
              <Input id="loss-date" type="date" {...form.register('occurredOn')} />
            </Field>
            <Field id="loss-count" label={t('losses.birds')}>
              <Input id="loss-count" type="number" min={0} {...form.register('birdCount', { valueAsNumber: true })} />
            </Field>
            <Field id="loss-note" label={t('losses.note')}>
              <TextArea id="loss-note" {...form.register('note')} />
            </Field>
            <Field id="loss-movement" label={`${t('losses.movement')} (${t('common.optional')})`}>
              <select id="loss-movement" className={selectClass} {...form.register('movementId')}>
                <option value="">{t('losses.none')}</option>
                {page.mortalityMovements.map((movement) => (
                  <option key={movement.id} value={movement.id}>
                    {movement.batchCode} · {movement.occurredOn} · {movement.birdCount}
                  </option>
                ))}
              </select>
            </Field>
            {mutation.isError ? <Alert>{explain(mutation.error, t)}</Alert> : null}
            <Button type="submit">{mutation.isPending ? t('losses.saving') : t('losses.save')}</Button>
          </form>
        </Card>
      ) : null}
    </div>
  );
}
