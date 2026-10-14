import { biosecurityStepSchema, healthObservationSchema, knowledgeApprovalSchema, medicineRecordSchema } from '@gavran/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { z } from 'zod';
import { ScreenTour } from '@/components/Tour';
import { JumpAdd } from '@/components/JumpAdd';
import { Alert, Button, Card, Field, Input, TextArea } from '@/components/ui';
import { ApiError, api, errorKey } from '@/lib/api';
import type { BiosecurityStep, FarmSummary, HealthObservation, KnowledgeEntry, MedicineRecord } from '@/lib/types';
import { localToday } from '@/lib/today';

function KnowledgeFacts({ entry }: { entry: KnowledgeEntry }) {
  const { t } = useTranslation();
  const facts = [
    ['health.usedFor', entry.usedFor],
    ['health.symptoms', entry.symptoms],
    ['health.howToGive', entry.howToGive],
    ['health.when', entry.scheduleText],
    ['health.precautions', entry.precautions],
  ].filter((item): item is [string, string] => Boolean(item[1]));
  if (facts.length === 0) return <p className="mt-2 whitespace-pre-wrap text-sm">{entry.textLayer}</p>;
  return (
    <dl className="mt-3 grid gap-2 text-sm">
      {facts.map(([key, value]) => (
        <div key={key}>
          <dt className="font-semibold">{t(key)}</dt>
          <dd className="whitespace-pre-wrap">{value}</dd>
        </div>
      ))}
    </dl>
  );
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

export function HealthPage() {
  const { farmId = '' } = useParams();
  const { t } = useTranslation();
  const [selected, setSelected] = useState<string | null>(null);
  const farms = useQuery({ queryKey: ['farms'], queryFn: () => api<FarmSummary[]>('/api/v1/farms') });
  const access = farms.data?.find((farm) => farm.id === farmId);
  const entries = useQuery({ queryKey: ['knowledge', farmId], queryFn: () => api<KnowledgeEntry[]>(`/api/v1/farms/${farmId}/knowledge`) });
  const observations = useQuery({
    queryKey: ['health-observations', farmId],
    queryFn: () => api<HealthObservation[]>(`/api/v1/farms/${farmId}/health-observations`),
  });
  const medicines = useQuery({
    queryKey: ['medicine-records', farmId],
    queryFn: () => api<MedicineRecord[]>(`/api/v1/farms/${farmId}/medicine-records`),
  });
  const steps = useQuery({
    queryKey: ['biosecurity', farmId],
    queryFn: () => api<BiosecurityStep[]>(`/api/v1/farms/${farmId}/biosecurity-steps`),
  });
  const canApprove = Boolean(access?.permissions.includes('health.approve'));
  const canRecord = Boolean(access?.permissions.includes('health.record'));
  const canTreat = Boolean(access?.permissions.includes('health.treat'));

  if (entries.isLoading || observations.isLoading || medicines.isLoading || steps.isLoading || farms.isLoading) return <p>{t('common.loading')}</p>;
  if (entries.isError || !entries.data) return <Alert>{explain(entries.error, t)}</Alert>;
  const current = entries.data.find((entry) => entry.id === selected) ?? null;
  const approved = entries.data.filter((entry) => entry.approved);

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 data-tour="screen-title" className="font-display text-3xl font-semibold">{t('health.title')}</h1>
          <p data-tour="screen-body" className="mt-1 text-ink-soft">{t('health.body')}</p>
          <ScreenTour screen="health" />
        </div>
        {canRecord ? <JumpAdd add="health" target="create-health">{t('health.saveObservation')}</JumpAdd> : null}
      </div>
      <p className="rounded-xl bg-gold/30 px-3 py-2 text-sm">{t('health.verify')}</p>
      <section className="grid gap-3">
        <h2 data-tour="screen-action" className="font-display text-2xl">{t('health.pages')}</h2>
        <div className="grid gap-2">
          {entries.data.map((entry) => (
            <button
              key={entry.id}
              type="button"
              className="rounded-xl border border-line bg-white px-3 py-2 text-left"
              onClick={() => setSelected(entry.id)}
            >
              <span className="font-semibold">{entry.title}</span>
              <span className="mt-1 block text-sm text-ink-soft">
                {t(`health.kind.${entry.kind}`)} · {t('health.page', { page: entry.sourcePage })} · {entry.approved ? t('health.approved') : t('health.unapproved')}
              </span>
            </button>
          ))}
        </div>
        {current ? (
          <Card>
            <h3 className="font-display text-xl">{current.title}</h3>
            <p className="text-sm text-ink-soft">{t(`health.kind.${current.kind}`)} · {t('health.page', { page: current.sourcePage })} · {current.verifyLabel}</p>
            <KnowledgeFacts entry={current} />
            {canApprove ? <ApprovalForm farmId={farmId} entry={current} /> : null}
            {canTreat && current.approved ? <VaccineForm farmId={farmId} entryId={current.id} /> : null}
          </Card>
        ) : null}
      </section>
      <section className="grid gap-3">
        <h2 className="font-display text-2xl">{t('health.observations')}</h2>
        {observations.data?.length === 0 ? <p className="text-ink-soft">{t('health.noObservations')}</p> : null}
        {observations.data?.map((item) => (
          <Card key={item.id}>
            <p className="font-semibold">{item.observedOn}</p>
            <p>{item.notes}</p>
          </Card>
        ))}
        {canRecord ? <ObservationForm farmId={farmId} entries={entries.data} /> : null}
      </section>
      <section className="grid gap-3">
        <h2 className="font-display text-2xl">{t('health.medicine')}</h2>
        <p className="text-sm text-ink-soft">{t('health.medicineNote')}</p>
        {medicines.data?.map((item) => (
          <Card key={item.id}>
            <p className="font-semibold">{item.givenOn}</p>
            <p>{item.notes}</p>
            <p className="text-sm text-ink-soft">{item.entryTitle}</p>
          </Card>
        ))}
        {canTreat ? <MedicineForm farmId={farmId} entries={approved} /> : null}
      </section>
      <section className="grid gap-3">
        <h2 className="font-display text-2xl">{t('health.biosecurity')}</h2>
        <p className="text-sm text-ink-soft">{t('health.biosecurityNote')}</p>
        {steps.data?.length === 0 ? <p className="text-ink-soft">{t('health.noSteps')}</p> : null}
        {steps.data?.map((step) => (
          <Card key={step.id}>
            <p>{step.body}</p>
            <p className="text-sm text-ink-soft">
              {step.origin === 'pdf' ? `${step.sourceFile} · ${t('health.page', { page: step.sourcePage ?? 0 })}` : t('health.ownerStep')}
              {step.mustVerify && !step.approved ? ` · ${t('health.unapproved')}` : ''}
            </p>
          </Card>
        ))}
        {canRecord ? <BiosecurityForm farmId={farmId} /> : null}
      </section>
    </div>
  );
}

function ApprovalForm({ farmId, entry }: { farmId: string; entry: KnowledgeEntry }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const form = useForm<z.infer<typeof knowledgeApprovalSchema>>({
    resolver: zodResolver(knowledgeApprovalSchema),
    defaultValues: { approved: true, verificationNote: entry.verificationNote ?? '' },
  });
  const mutation = useMutation({
    mutationFn: (values: z.infer<typeof knowledgeApprovalSchema>) =>
      api(`/api/v1/farms/${farmId}/knowledge/${entry.id}/approval`, { method: 'POST', json: values }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['knowledge', farmId] }),
  });
  return (
    <form className="mt-3 grid gap-3" onSubmit={form.handleSubmit((values) => mutation.mutate(values))}>
      <Field id="verify-note" label={t('health.verificationNote')} hint={t('fieldHint.verify-note')}>
        <TextArea id="verify-note" {...form.register('verificationNote')}  placeholder={t('fieldPh.verify-note')}/>
      </Field>
      {mutation.isError ? <Alert>{explain(mutation.error, t)}</Alert> : null}
      <Button type="submit">{t('health.approve')}</Button>
    </form>
  );
}

function VaccineForm({ farmId, entryId }: { farmId: string; entryId: string }) {
  const { t } = useTranslation();
  const [dueOn, setDueOn] = useState('');
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  return (
    <form
      className="mt-3 grid gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        setError(null);
        void api(`/api/v1/farms/${farmId}/knowledge/${entryId}/vaccine-task`, { method: 'POST', json: { dueOn, assigneeUserId: '' } })
          .then(() => queryClient.invalidateQueries({ queryKey: ['tasks', farmId] }))
          .catch((caught: unknown) => setError(explain(caught, t)));
      }}
    >
      <Field id="vaccine-due" label={t('health.taskDue')} hint={t('fieldHint.vaccine-due')}>
        <Input id="vaccine-due" type="date" allowFuture value={dueOn} onChange={(event) => setDueOn(event.target.value)} />
      </Field>
      {error ? <Alert>{error}</Alert> : null}
      <Button type="submit" variant="outline">
        {t('health.makeTask')}
      </Button>
    </form>
  );
}

function ObservationForm({ farmId, entries }: { farmId: string; entries: KnowledgeEntry[] }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const form = useForm<z.infer<typeof healthObservationSchema>>({
    resolver: zodResolver(healthObservationSchema),
    defaultValues: { observedOn: localToday(), batchId: '', birdCount: null, notes: '', entryId: '' },
  });
  const mutation = useMutation({
    mutationFn: (values: z.infer<typeof healthObservationSchema>) =>
      api(`/api/v1/farms/${farmId}/health-observations`, { method: 'POST', json: values }),
    onSuccess: () => {
      form.reset();
      void queryClient.invalidateQueries({ queryKey: ['health-observations', farmId] });
    },
  });
  return (
    <Card>
      <div id="create-health" />
      <form className="grid gap-3" onSubmit={form.handleSubmit((values) => mutation.mutate(values))}>
        <Field id="obs-date" label={t('health.date')} hint={t('fieldHint.obs-date')}>
          <Input id="obs-date" type="date" {...form.register('observedOn')} />
        </Field>
        <Field id="obs-notes" label={t('health.notes')} hint={t('fieldHint.obs-notes')}>
          <TextArea id="obs-notes" {...form.register('notes')}  placeholder={t('fieldPh.obs-notes')}/>
        </Field>
        <Field id="obs-entry" label={`${t('health.linkPage')} (${t('common.optional')})`} hint={t('fieldHint.obs-entry')}>
          <select id="obs-entry" className="min-h-11 w-full rounded-xl border border-line bg-white px-3" {...form.register('entryId')}>
            <option value="">{t('health.none')}</option>
            {entries.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.title}
              </option>
            ))}
          </select>
        </Field>
        {mutation.isError ? <Alert>{explain(mutation.error, t)}</Alert> : null}
        <Button type="submit">{t('health.saveObservation')}</Button>
      </form>
    </Card>
  );
}

function MedicineForm({ farmId, entries }: { farmId: string; entries: KnowledgeEntry[] }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const form = useForm<z.infer<typeof medicineRecordSchema>>({
    resolver: zodResolver(medicineRecordSchema),
    defaultValues: { entryId: '', givenOn: localToday(), batchId: '', notes: '' },
  });
  const mutation = useMutation({
    mutationFn: (values: z.infer<typeof medicineRecordSchema>) =>
      api(`/api/v1/farms/${farmId}/medicine-records`, { method: 'POST', json: values }),
    onSuccess: () => {
      form.reset();
      void queryClient.invalidateQueries({ queryKey: ['medicine-records', farmId] });
      void queryClient.invalidateQueries({ queryKey: ['tasks', farmId] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard', farmId] });
    },
  });
  return (
    <Card>
      <form className="grid gap-3" onSubmit={form.handleSubmit((values) => mutation.mutate(values))}>
        <Field id="med-entry" label={t('health.approvedPage')} hint={t('fieldHint.med-entry')}>
          <select id="med-entry" className="min-h-11 w-full rounded-xl border border-line bg-white px-3" {...form.register('entryId')}>
            <option value="">{entries.length === 0 ? t('health.noneApproved') : t('health.choose')}</option>
            {entries.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.title}
              </option>
            ))}
          </select>
        </Field>
        <Field id="med-date" label={t('health.date')} hint={t('fieldHint.med-date')}>
          <Input id="med-date" type="date" {...form.register('givenOn')} />
        </Field>
        <Field id="med-notes" label={t('health.whatYouDid')} hint={t('health.whatYouDidHint')}>
          <TextArea id="med-notes" {...form.register('notes')}  placeholder={t('fieldPh.med-notes')}/>
        </Field>
        {mutation.isError ? <Alert>{explain(mutation.error, t)}</Alert> : null}
        <Button type="submit">{t('health.saveMedicine')}</Button>
      </form>
    </Card>
  );
}

function BiosecurityForm({ farmId }: { farmId: string }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const form = useForm<z.infer<typeof biosecurityStepSchema>>({
    resolver: zodResolver(biosecurityStepSchema),
    defaultValues: { origin: 'owner', body: '', sourceFile: '', sourcePage: null },
  });
  const mutation = useMutation({
    mutationFn: (values: z.infer<typeof biosecurityStepSchema>) =>
      api(`/api/v1/farms/${farmId}/biosecurity-steps`, { method: 'POST', json: values }),
    onSuccess: () => {
      form.reset({ origin: 'owner', body: '', sourceFile: '', sourcePage: null });
      void queryClient.invalidateQueries({ queryKey: ['biosecurity', farmId] });
    },
  });
  return (
    <Card>
      <form className="grid gap-3" onSubmit={form.handleSubmit((values) => mutation.mutate(values))}>
        <Field id="bio-body" label={t('health.yourStep')} hint={t('fieldHint.bio-body')}>
          <TextArea id="bio-body" {...form.register('body')}  placeholder={t('fieldPh.bio-body')}/>
        </Field>
        {mutation.isError ? <Alert>{explain(mutation.error, t)}</Alert> : null}
        <Button type="submit">{t('health.saveStep')}</Button>
      </form>
      <form
        className="mt-4 grid gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          const page = Number(new FormData(event.currentTarget).get('page'));
          mutation.mutate({
            origin: 'pdf',
            body: '',
            sourceFile: 'patil-poultry-step-by-step-process.pdf',
            sourcePage: page,
          });
        }}
      >
        <Field id="bio-page" label={t('health.copyPage')} hint={t('health.copyHint')}>
          <Input id="bio-page" name="page" type="number" min={1} max={27} />
        </Field>
        <Button type="submit" variant="outline">
          {t('health.copy')}
        </Button>
      </form>
    </Card>
  );
}
