import { reportRunSchema, reportScheduleInputSchema } from '@gavran/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { z } from 'zod';
import { JumpAdd } from '@/components/JumpAdd';
import { Alert, Button, Card, Field, Input, TextArea } from '@/components/ui';
import { ApiError, api, errorKey } from '@/lib/api';
import { localToday } from '@/lib/today';

type Schedule = { id: string; name: string; note: string; namedOn: string };
type SchedulePage = {
  schedules: Schedule[];
  delivery: 'not_sent';
  cadence: { status: 'not_chosen'; reason: string };
};
type RunResult = {
  schedule: Schedule;
  report: { from: string; to: string; sections: Array<{ id: string; total?: number }> };
};

function explain(error: unknown, t: (key: string) => string) {
  if (error instanceof ApiError) {
    if (error.status === 403) return t('common.permissionDenied');
    if (error.status === 404) return t('farm.notFound');
    const key = errorKey(error);
    return key ? t(key) : t('common.errorGeneric');
  }
  return t('common.errorGeneric');
}

function RunForm({ farmId, scheduleId }: { farmId: string; scheduleId: string }) {
  const { t } = useTranslation();
  const form = useForm<z.infer<typeof reportRunSchema>>({
    resolver: zodResolver(reportRunSchema),
    defaultValues: { from: '', to: '' },
  });
  const [result, setResult] = useState<RunResult | null>(null);
  const run = useMutation({
    mutationFn: (values: z.infer<typeof reportRunSchema>) =>
      api<RunResult>(`/api/v1/farms/${farmId}/report-schedules/${scheduleId}/run`, { method: 'POST', json: values }),
    onSuccess: (data) => setResult(data),
  });
  const eggs = result?.report.sections.find((section) => section.id === 'eggs');
  return (
    <form className="mt-3 grid gap-3" onSubmit={form.handleSubmit((values) => run.mutate(values))}>
      <Field id={`from-${scheduleId}`} label={t('schedules.from')} hint={t('fieldHint.from')}>
        <Input id={`from-${scheduleId}`} type="date" {...form.register('from')} />
      </Field>
      <Field id={`to-${scheduleId}`} label={t('schedules.to')} hint={t('fieldHint.to')}>
        <Input id={`to-${scheduleId}`} type="date" {...form.register('to')} />
      </Field>
      {run.isError ? <Alert>{explain(run.error, t)}</Alert> : null}
      {result ? <p>{t('schedules.eggTotal', { count: eggs?.total ?? 0, from: result.report.from, to: result.report.to })}</p> : null}
      <Button type="submit">{run.isPending ? t('schedules.running') : t('schedules.run')}</Button>
    </form>
  );
}

export function SchedulesPage() {
  const { farmId = '' } = useParams();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const page = useQuery({ queryKey: ['schedules', farmId], queryFn: () => api<SchedulePage>(`/api/v1/farms/${farmId}/report-schedules`) });
  const form = useForm<z.infer<typeof reportScheduleInputSchema>>({
    resolver: zodResolver(reportScheduleInputSchema),
    defaultValues: { name: '', note: '', namedOn: localToday() },
  });
  const save = useMutation({
    mutationFn: (values: z.infer<typeof reportScheduleInputSchema>) =>
      api(`/api/v1/farms/${farmId}/report-schedules`, { method: 'POST', json: values }),
    onSuccess: () => {
      form.reset({ name: '', note: '', namedOn: localToday() });
      void queryClient.invalidateQueries({ queryKey: ['schedules', farmId] });
    },
  });

  if (page.isLoading) return <p>{t('common.loading')}</p>;
  if (page.isError || !page.data) return <Alert>{explain(page.error, t)}</Alert>;

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold">{t('schedules.title')}</h1>
          <p className="mt-1 text-ink-soft">{t('schedules.body')}</p>
        </div>
        <JumpAdd add="schedules" target="create-schedules">{t('schedules.add')}</JumpAdd>
      </div>
      <p className="rounded-xl bg-gold/30 px-3 py-2 text-sm">{t('schedules.notSent')}</p>
      {page.data.schedules.length === 0 ? (
        <Card>
          <h2 className="font-display text-2xl">{t('schedules.emptyTitle')}</h2>
          <p className="text-ink-soft">{t('schedules.emptyBody')}</p>
          <JumpAdd add="schedules" target="create-schedules">{t('schedules.add')}</JumpAdd>
        </Card>
      ) : (
        page.data.schedules.map((schedule) => (
          <Card key={schedule.id}>
            <p className="font-semibold">{schedule.name}</p>
            <p className="text-sm text-ink-soft">{schedule.namedOn}</p>
            {schedule.note ? <p>{schedule.note}</p> : null}
            <RunForm farmId={farmId} scheduleId={schedule.id} />
          </Card>
        ))
      )}
      <Card>
        <div id="create-schedules" />
        <form className="grid gap-3" onSubmit={form.handleSubmit((values) => save.mutate(values))}>
          <h2 className="font-display text-2xl">{t('schedules.add')}</h2>
          <Field id="sch-name" label={t('schedules.name')} hint={t('fieldHint.sch-name')}>
            <Input id="sch-name" {...form.register('name')}  placeholder={t('fieldPh.sch-name')}/>
          </Field>
          <Field id="sch-note" label={t('schedules.note')} hint={t('fieldHint.sch-note')}>
            <TextArea id="sch-note" {...form.register('note')}  placeholder={t('fieldPh.sch-note')}/>
          </Field>
          <Field id="sch-date" label={t('schedules.namedOn')} hint={t('fieldHint.sch-date')}>
            <Input id="sch-date" type="date" allowFuture {...form.register('namedOn')} />
          </Field>
          {save.isError ? <Alert>{explain(save.error, t)}</Alert> : null}
          <Button type="submit">{save.isPending ? t('schedules.saving') : t('schedules.save')}</Button>
        </form>
      </Card>
    </div>
  );
}
