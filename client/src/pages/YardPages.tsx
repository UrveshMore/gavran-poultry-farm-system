import { yardNoteSchema } from '@gavran/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { z } from 'zod';
import { Alert, Button, Card, Field, Input, TextArea } from '@/components/ui';
import { ApiError, api, errorKey } from '@/lib/api';
import { localToday } from '@/lib/today';
import type { FarmSummary, YardPage } from '@/lib/types';

const selectClass = 'min-h-11 w-full rounded-xl border border-line bg-white px-3';

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

export function YardPageView() {
  const { farmId = '' } = useParams();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const farms = useQuery({ queryKey: ['farms'], queryFn: () => api<FarmSummary[]>('/api/v1/farms') });
  const access = farms.data?.find((farm) => farm.id === farmId);
  const yard = useQuery({ queryKey: ['yard', farmId], queryFn: () => api<YardPage>(`/api/v1/farms/${farmId}/yard-notes`) });
  const canRecord = Boolean(access?.permissions.includes('yard.record'));
  const form = useForm<z.infer<typeof yardNoteSchema>>({
    resolver: zodResolver(yardNoteSchema),
    defaultValues: { notedOn: localToday(), kind: 'let_out', notedTime: '', body: '' },
  });
  const mutation = useMutation({
    mutationFn: (values: z.infer<typeof yardNoteSchema>) => api(`/api/v1/farms/${farmId}/yard-notes`, { method: 'POST', json: values }),
    onSuccess: () => {
      form.reset({ notedOn: localToday(), kind: 'let_out', notedTime: '', body: '' });
      void queryClient.invalidateQueries({ queryKey: ['yard', farmId] });
    },
  });

  if (yard.isLoading) return <p>{t('common.loading')}</p>;
  if (yard.isError || !yard.data) return <Alert>{explain(yard.error, t)}</Alert>;

  return (
    <div className="grid gap-4">
      <div>
        <h1 data-tour="screen-title" className="font-display text-3xl font-semibold">{t('yard.title')}</h1>
        <p data-tour="screen-body" className="mt-1 text-ink-soft">{t('yard.body')}</p>
      </div>
      <p className="rounded-xl bg-gold/30 px-3 py-2 text-sm">{t('yard.noClock')}</p>
      {yard.data.notes.length === 0 ? (
        <Card>
          <h2 className="font-display text-2xl">{t('yard.emptyTitle')}</h2>
          <p className="text-ink-soft">{t('yard.emptyBody')}</p>
        </Card>
      ) : (
        yard.data.notes.map((note) => (
          <Card key={note.id}>
            <p className="font-semibold">
              {note.notedOn}
              {note.notedTime ? ` · ${note.notedTime}` : ''} · {t(`yard.kind.${note.kind}`)}
            </p>
            <p>{note.body}</p>
          </Card>
        ))
      )}
      {canRecord ? (
        <Card>
          <form className="grid gap-3" onSubmit={form.handleSubmit((values) => mutation.mutate(values))} noValidate>
            <h2 data-tour="screen-action" className="font-display text-2xl">{t('yard.add')}</h2>
            <Field id="yard-date" label={t('yard.date')} hint={t('fieldHint.yard-date')} error={text(t, form.formState.errors.notedOn?.message)}>
              <Input id="yard-date" type="date" {...form.register('notedOn')} />
            </Field>
            <Field id="yard-kind" label={t('yard.kindLabel')} hint={t('fieldHint.yard-kind')} error={text(t, form.formState.errors.kind?.message)}>
              <select id="yard-kind" className={selectClass} {...form.register('kind')}>
                <option value="let_out">{t('yard.kind.let_out')}</option>
                <option value="shut_in">{t('yard.kind.shut_in')}</option>
                <option value="note">{t('yard.kind.note')}</option>
              </select>
            </Field>
            <Field id="yard-time" label={`${t('yard.time')} (${t('common.optional')})`} hint={t('fieldHint.yard-time')} error={text(t, form.formState.errors.notedTime?.message)}>
              <Input id="yard-time" type="time" {...form.register('notedTime')} />
            </Field>
            <Field id="yard-body" label={t('yard.what')} hint={t('fieldHint.yard-body')} error={text(t, form.formState.errors.body?.message)}>
              <TextArea id="yard-body" placeholder={t('fieldPh.yard-body')} {...form.register('body')} />
            </Field>
            {mutation.isError ? <Alert>{explain(mutation.error, t)}</Alert> : null}
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? t('yard.saving') : t('yard.save')}
            </Button>
          </form>
        </Card>
      ) : null}
    </div>
  );
}
