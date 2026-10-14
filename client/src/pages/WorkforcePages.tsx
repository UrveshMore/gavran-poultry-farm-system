import { attendanceInputSchema, trainingAssignmentInputSchema, trainingCompletionSchema, trainingItemInputSchema } from '@gavran/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { z } from 'zod';
import { JumpAdd } from '@/components/JumpAdd';
import { Alert, Button, Card, Field, Input, TextArea } from '@/components/ui';
import { ApiError, api, errorKey, fetchMe } from '@/lib/api';
import { queueAttendance } from '@/lib/offlineQueue';
import type { AttendancePage, FarmSummary, Member, TrainingPage } from '@/lib/types';
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

export function WorkforcePage() {
  const { farmId = '' } = useParams();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const me = useQuery({ queryKey: ['me'], queryFn: fetchMe });
  const farms = useQuery({ queryKey: ['farms'], queryFn: () => api<FarmSummary[]>('/api/v1/farms') });
  const access = farms.data?.find((farm) => farm.id === farmId);
  const attendance = useQuery({
    queryKey: ['attendance', farmId],
    queryFn: () => api<AttendancePage>(`/api/v1/farms/${farmId}/attendance`),
    enabled: Boolean(access?.permissions.includes('attendance.read')),
  });
  const training = useQuery({
    queryKey: ['training', farmId],
    queryFn: () => api<TrainingPage>(`/api/v1/farms/${farmId}/training`),
    enabled: Boolean(access?.permissions.includes('training.read')),
  });
  const members = useQuery({
    queryKey: ['members', farmId],
    queryFn: () => api<Member[]>(`/api/v1/farms/${farmId}/members`),
    enabled: Boolean(access?.permissions.includes('user.read')),
  });
  const canRecord = Boolean(access?.permissions.includes('attendance.record'));
  const [held, setHeld] = useState(false);
  const canManage = Boolean(access?.permissions.includes('training.manage'));
  const canComplete = Boolean(access?.permissions.includes('training.complete'));

  const attendanceForm = useForm<z.infer<typeof attendanceInputSchema>>({
    resolver: zodResolver(attendanceInputSchema),
    defaultValues: { userId: '', attendedOn: localToday(), attendedTime: '', methodLabel: '', note: '' },
  });
  const itemForm = useForm<z.infer<typeof trainingItemInputSchema>>({
    resolver: zodResolver(trainingItemInputSchema),
    defaultValues: { title: '', body: '', versionLabel: '' },
  });
  const assignForm = useForm<z.infer<typeof trainingAssignmentInputSchema>>({
    resolver: zodResolver(trainingAssignmentInputSchema),
    defaultValues: { itemId: '', userId: '', dueOn: localToday() },
  });
  const completeForm = useForm<z.infer<typeof trainingCompletionSchema>>({
    resolver: zodResolver(trainingCompletionSchema),
    defaultValues: { note: '' },
  });

  const saveAttendance = useMutation({
    mutationFn: (values: z.infer<typeof attendanceInputSchema>) =>
      api(`/api/v1/farms/${farmId}/attendance`, { method: 'POST', json: values }),
    onSuccess: () => {
      attendanceForm.reset({ userId: '', attendedOn: localToday(), attendedTime: '', methodLabel: '', note: '' });
      void queryClient.invalidateQueries({ queryKey: ['attendance', farmId] });
    },
  });
  const saveItem = useMutation({
    mutationFn: (values: z.infer<typeof trainingItemInputSchema>) =>
      api(`/api/v1/farms/${farmId}/training-items`, { method: 'POST', json: values }),
    onSuccess: () => {
      itemForm.reset({ title: '', body: '', versionLabel: '' });
      void queryClient.invalidateQueries({ queryKey: ['training', farmId] });
    },
  });
  const saveAssignment = useMutation({
    mutationFn: (values: z.infer<typeof trainingAssignmentInputSchema>) =>
      api(`/api/v1/farms/${farmId}/training-assignments`, { method: 'POST', json: values }),
    onSuccess: () => {
      assignForm.reset({ itemId: '', userId: '', dueOn: localToday() });
      void queryClient.invalidateQueries({ queryKey: ['training', farmId] });
    },
  });
  const finish = useMutation({
    mutationFn: (input: { assignmentId: string; note: string }) =>
      api(`/api/v1/farms/${farmId}/training-assignments/${input.assignmentId}/completion`, {
        method: 'POST',
        json: { note: input.note },
      }),
    onSuccess: () => {
      completeForm.reset({ note: '' });
      void queryClient.invalidateQueries({ queryKey: ['training', farmId] });
    },
  });

  if (farms.isLoading || attendance.isLoading || training.isLoading) return <p>{t('common.loading')}</p>;
  if (attendance.isError) return <Alert>{explain(attendance.error, t)}</Alert>;
  if (training.isError) return <Alert>{explain(training.error, t)}</Alert>;

  const people = (members.data ?? []).filter((member) => member.status === 'active' && member.userStatus === 'active');

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold">{t('workforce.title')}</h1>
          <p className="mt-1 text-ink-soft">{t('workforce.body')}</p>
        </div>
        {canRecord ? <JumpAdd add="workforce" target="create-workforce">{t('workforce.saveAttendance')}</JumpAdd> : null}
      </div>
      {attendance.data ? (
        <p className="rounded-xl bg-gold/30 px-3 py-2 text-sm">{t('workforce.rowCount', { count: attendance.data.metric.rowCount })}</p>
      ) : null}
      <section className="grid gap-3">
        <h2 className="font-display text-2xl">{t('workforce.attendanceTitle')}</h2>
        {attendance.data && attendance.data.records.length === 0 ? (
          <Card>
            <p className="text-ink-soft">{t('workforce.emptyAttendance')}</p>
          </Card>
        ) : null}
        {attendance.data?.records.map((row) => (
          <Card key={row.id}>
            <p className="font-semibold">
              {row.attendedOn}
              {row.attendedTime ? ` · ${row.attendedTime}` : ''} · {row.displayName}
            </p>
            <p>{row.methodLabel}</p>
            {row.note ? <p className="text-sm text-ink-soft">{row.note}</p> : null}
          </Card>
        ))}
        {canRecord ? (
          <Card>
            <div id="create-workforce" />
            <form
              className="grid gap-3"
              onSubmit={attendanceForm.handleSubmit((values) => {
                if (!navigator.onLine) {
                  const outcome = queueAttendance(farmId, values);
                  if (outcome === 'queued') {
                    setHeld(true);
                    attendanceForm.reset({ userId: '', attendedOn: localToday(), attendedTime: '', methodLabel: '', note: '' });
                  }
                  return;
                }
                setHeld(false);
                saveAttendance.mutate(values);
              })}
            >
              <h3 className="font-display text-xl">{t('workforce.saveAttendance')}</h3>
              {people.length > 0 ? (
                <Field id="att-person" label={t('workforce.person')} hint={t('fieldHint.att-person')}>
                  <select id="att-person" className={selectClass} {...attendanceForm.register('userId')}>
                    <option value="">{t('workforce.self')}</option>
                    {people.map((member) => (
                      <option key={member.userId} value={member.userId}>
                        {member.displayName}
                      </option>
                    ))}
                  </select>
                </Field>
              ) : null}
              <Field id="att-date" label={t('workforce.date')} hint={t('fieldHint.att-date')}>
                <Input id="att-date" type="date" {...attendanceForm.register('attendedOn')} />
              </Field>
              <Field id="att-time" label={`${t('workforce.time')} (${t('common.optional')})`} hint={t('workforce.timeHint')}>
                <Input id="att-time" type="time" {...attendanceForm.register('attendedTime')} />
              </Field>
              <Field id="att-method" label={t('workforce.method')} hint={t('workforce.methodHint')}>
                <Input id="att-method" {...attendanceForm.register('methodLabel')}  placeholder={t('fieldPh.att-method')}/>
              </Field>
              <Field id="att-note" label={`${t('workforce.note')} (${t('common.optional')})`} hint={t('fieldHint.att-note')}>
                <TextArea id="att-note" {...attendanceForm.register('note')}  placeholder={t('fieldPh.att-note')}/>
              </Field>
              {held ? <Alert tone="ok">{t('offline.held')}</Alert> : null}
              {saveAttendance.isError ? <Alert>{explain(saveAttendance.error, t)}</Alert> : null}
              <Button type="submit">{saveAttendance.isPending ? t('workforce.saving') : t('workforce.saveAttendance')}</Button>
            </form>
          </Card>
        ) : null}
      </section>
      <section className="grid gap-3">
        <h2 className="font-display text-2xl">{t('workforce.trainingTitle')}</h2>
        {training.data && training.data.items.length === 0 ? (
          <Card>
            <p className="text-ink-soft">{t('workforce.emptyTraining')}</p>
          </Card>
        ) : null}
        {training.data?.items.map((item) => (
          <Card key={item.id}>
            <p className="font-semibold">{item.title}</p>
            <p className="text-sm text-ink-soft">{t('workforce.versionOf', { version: item.versionLabel })}</p>
            <p className="mt-1">{item.body}</p>
          </Card>
        ))}
        {training.data?.assignments.map((row) => (
          <Card key={row.id}>
            <p className="font-semibold">{row.itemTitle}</p>
            <p className="text-sm text-ink-soft">
              {t('workforce.for', { name: row.displayName })}
              {row.dueOn ? ` · ${row.dueOn}` : ''}
            </p>
            <p>{row.completionId ? t('workforce.done') : t('workforce.open')}</p>
            {row.completionNote ? <p className="text-sm">{row.completionNote}</p> : null}
            {canComplete && !row.completionId && row.userId === me.data?.id ? (
              <form
                className="mt-3 grid gap-3"
                onSubmit={completeForm.handleSubmit((values) => finish.mutate({ assignmentId: row.id, note: values.note }))}
              >
                <Field id={`done-${row.id}`} label={`${t('workforce.completeNote')} (${t('common.optional')})`} hint={t('fieldHint.done')}>
                  <TextArea id={`done-${row.id}`} {...completeForm.register('note')}  placeholder={t('fieldPh.done')}/>
                </Field>
                {finish.isError ? <Alert>{explain(finish.error, t)}</Alert> : null}
                <Button type="submit">{finish.isPending ? t('workforce.saving') : t('workforce.complete')}</Button>
              </form>
            ) : null}
          </Card>
        ))}
        {canManage ? (
          <Card>
            <form className="grid gap-3" onSubmit={itemForm.handleSubmit((values) => saveItem.mutate(values))}>
              <h3 className="font-display text-xl">{t('workforce.saveItem')}</h3>
              <Field id="tr-title" label={t('workforce.itemTitle')} hint={t('fieldHint.tr-title')}>
                <Input id="tr-title" {...itemForm.register('title')}  placeholder={t('fieldPh.tr-title')}/>
              </Field>
              <Field id="tr-body" label={t('workforce.itemBody')} hint={t('fieldHint.tr-body')}>
                <TextArea id="tr-body" {...itemForm.register('body')}  placeholder={t('fieldPh.tr-body')}/>
              </Field>
              <Field id="tr-version" label={t('workforce.version')} hint={t('workforce.versionHint')}>
                <Input id="tr-version" {...itemForm.register('versionLabel')}  placeholder={t('fieldPh.tr-version')}/>
              </Field>
              {saveItem.isError ? <Alert>{explain(saveItem.error, t)}</Alert> : null}
              <Button type="submit">{saveItem.isPending ? t('workforce.saving') : t('workforce.saveItem')}</Button>
            </form>
          </Card>
        ) : null}
        {canManage && training.data && training.data.items.length > 0 && people.length > 0 ? (
          <Card>
            <form className="grid gap-3" onSubmit={assignForm.handleSubmit((values) => saveAssignment.mutate(values))}>
              <h3 className="font-display text-xl">{t('workforce.assign')}</h3>
              <Field id="as-item" label={t('workforce.itemTitle')} hint={t('fieldHint.as-item')}>
                <select id="as-item" className={selectClass} {...assignForm.register('itemId')}>
                  <option value="">{t('common.optional')}</option>
                  {training.data.items.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.title}
                    </option>
                  ))}
                </select>
              </Field>
              <Field id="as-person" label={t('workforce.person')} hint={t('fieldHint.as-person')}>
                <select id="as-person" className={selectClass} {...assignForm.register('userId')}>
                  <option value="">{t('common.optional')}</option>
                  {people.map((member) => (
                    <option key={member.userId} value={member.userId}>
                      {member.displayName}
                    </option>
                  ))}
                </select>
              </Field>
              <Field id="as-due" label={`${t('workforce.due')} (${t('common.optional')})`} hint={t('workforce.dueHint')}>
                <Input id="as-due" type="date" allowFuture {...assignForm.register('dueOn')} />
              </Field>
              {saveAssignment.isError ? <Alert>{explain(saveAssignment.error, t)}</Alert> : null}
              <Button type="submit">{saveAssignment.isPending ? t('workforce.saving') : t('workforce.saveAssignment')}</Button>
            </form>
          </Card>
        ) : null}
      </section>
    </div>
  );
}
