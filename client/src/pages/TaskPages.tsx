import { taskCompleteSchema, taskInputSchema, taskStepInputSchema, taskTemplateRenameSchema } from '@gavran/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import { z } from 'zod';
import { Alert, Button, Card, Field, Input, TextArea } from '@/components/ui';
import { ApiError, api, errorKey } from '@/lib/api';
import type { FarmSummary, FarmTask, Member, TaskSeason, TaskTemplate } from '@/lib/types';

const seasons: TaskSeason[] = ['summer_heat', 'monsoon', 'winter'];
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

export function TasksPage() {
  const { farmId = '' } = useParams();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [seasonError, setSeasonError] = useState<string | null>(null);
  const [seasonPending, setSeasonPending] = useState<TaskSeason | null>(null);
  const farms = useQuery({ queryKey: ['farms'], queryFn: () => api<FarmSummary[]>('/api/v1/farms') });
  const access = farms.data?.find((farm) => farm.id === farmId);
  const templates = useQuery({
    queryKey: ['task-templates', farmId],
    queryFn: () => api<TaskTemplate[]>(`/api/v1/farms/${farmId}/task-templates`),
  });
  const tasks = useQuery({ queryKey: ['tasks', farmId], queryFn: () => api<FarmTask[]>(`/api/v1/farms/${farmId}/tasks`) });
  const canManage = Boolean(access?.permissions.includes('task.manage'));
  const canReadPeople = Boolean(access?.permissions.includes('user.read'));
  const members = useQuery({
    queryKey: ['members', farmId],
    queryFn: () => api<Member[]>(`/api/v1/farms/${farmId}/members`),
    enabled: canManage && canReadPeople,
  });

  async function addSeason(season: TaskSeason) {
    setSeasonError(null);
    setSeasonPending(season);
    try {
      await api(`/api/v1/farms/${farmId}/task-templates`, {
        method: 'POST',
        json: { name: t(`tasks.season.${season}`), season },
      });
      await queryClient.invalidateQueries({ queryKey: ['task-templates', farmId] });
    } catch (caught) {
      setSeasonError(explain(caught, t));
    } finally {
      setSeasonPending(null);
    }
  }

  if (templates.isLoading || tasks.isLoading) return <p>{t('common.loading')}</p>;
  if (templates.isError || !templates.data) return <Alert>{explain(templates.error, t)}</Alert>;
  if (tasks.isError || !tasks.data) return <Alert>{explain(tasks.error, t)}</Alert>;

  const people = (members.data ?? []).filter((member) => member.status === 'active' && member.userStatus === 'active');

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold">{t('tasks.title')}</h1>
          <p className="mt-1 text-ink-soft">{t('tasks.body')}</p>
        </div>
        {canManage ? (
          <Button type="button" variant={open ? 'outline' : 'default'} onClick={() => setOpen((value) => !value)}>
            {open ? t('tasks.hideForm') : t('tasks.add')}
          </Button>
        ) : null}
      </div>
      <p className="rounded-xl bg-gold/30 px-3 py-2 text-sm">{t('tasks.noSchedule')}</p>
      <p className="text-sm text-ink-soft">{t('tasks.onlineOnly')}</p>
      {seasonError ? <Alert>{seasonError}</Alert> : null}
      {canManage ? (
        <div className="flex flex-wrap gap-2">
          {seasons.map((season) => {
            const existing = templates.data?.some((item) => item.season === season);
            return (
              <Button key={season} type="button" variant="outline" disabled={existing || seasonPending !== null} onClick={() => void addSeason(season)}>
                {seasonPending === season ? t('tasks.saving') : t(`tasks.season.${season}`)}
              </Button>
            );
          })}
        </div>
      ) : null}
      <section className="grid gap-3">
        <h2 className="font-display text-2xl">{t('tasks.templates')}</h2>
        {templates.data.length === 0 ? <p className="text-ink-soft">{t('tasks.noTemplates')}</p> : null}
        {templates.data.map((template) => (
          <TemplateCard key={template.id} farmId={farmId} template={template} canManage={canManage} />
        ))}
      </section>
      {open && canManage ? (
        <TaskForm
          farmId={farmId}
          templates={templates.data}
          people={people}
          onDone={() => {
            setOpen(false);
            void queryClient.invalidateQueries({ queryKey: ['tasks', farmId] });
          }}
        />
      ) : null}
      {tasks.data.length === 0 ? (
        <Card>
          <h2 className="font-display text-2xl">{t('tasks.emptyTitle')}</h2>
          <p className="text-ink-soft">{t('tasks.emptyBody')}</p>
        </Card>
      ) : (
        <div className="grid gap-3">
          {tasks.data.map((task) => (
            <Card key={task.id}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="font-display text-xl">{task.title}</h2>
                  <p className="text-sm text-ink-soft">
                    {task.dueOn} · {t(`tasks.status.${task.status}`)}
                    {task.overdue ? ` · ${t('tasks.overdue')}` : ''}
                    {task.assigneeName ? ` · ${task.assigneeName}` : ''}
                  </p>
                </div>
                <Button asChild variant="outline">
                  <Link to={`/farms/${farmId}/tasks/${task.id}`}>{t('tasks.open')}</Link>
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function TemplateCard({ farmId, template, canManage }: { farmId: string; template: TaskTemplate; canManage: boolean }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const rename = useForm<z.infer<typeof taskTemplateRenameSchema>>({
    resolver: zodResolver(taskTemplateRenameSchema),
    defaultValues: { name: template.name },
  });
  const step = useForm<z.infer<typeof taskStepInputSchema>>({ resolver: zodResolver(taskStepInputSchema), defaultValues: { body: '' } });

  const renameMutation = useMutation({
    mutationFn: (values: z.infer<typeof taskTemplateRenameSchema>) =>
      api(`/api/v1/farms/${farmId}/task-templates/${template.id}`, { method: 'PATCH', json: values }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['task-templates', farmId] }),
  });
  const stepMutation = useMutation({
    mutationFn: (values: z.infer<typeof taskStepInputSchema>) =>
      api(`/api/v1/farms/${farmId}/task-templates/${template.id}/steps`, { method: 'POST', json: values }),
    onSuccess: () => {
      step.reset({ body: '' });
      void queryClient.invalidateQueries({ queryKey: ['task-templates', farmId] });
    },
  });

  async function setStatus(stepId: string, status: 'active' | 'skipped') {
    setError(null);
    try {
      await api(`/api/v1/farms/${farmId}/task-templates/${template.id}/steps/${stepId}`, { method: 'PATCH', json: { status } });
      await queryClient.invalidateQueries({ queryKey: ['task-templates', farmId] });
    } catch (caught) {
      setError(explain(caught, t));
    }
  }

  return (
    <Card>
      <p className="text-sm text-ink-soft">{template.season ? t(`tasks.season.${template.season}`) : t('tasks.custom')}</p>
      {canManage ? (
        <form className="mt-2 flex flex-wrap items-end gap-2" onSubmit={rename.handleSubmit((values) => renameMutation.mutate(values))}>
          <div className="min-w-48 flex-1">
            <Field id={`rename-${template.id}`} label={t('tasks.rename')} error={text(t, rename.formState.errors.name?.message)}>
              <Input id={`rename-${template.id}`} {...rename.register('name')} />
            </Field>
          </div>
          <Button type="submit" variant="outline">
            {t('tasks.saveName')}
          </Button>
        </form>
      ) : (
        <h3 className="font-display text-xl">{template.name}</h3>
      )}
      {template.steps.length === 0 ? <p className="mt-3 text-ink-soft">{t('tasks.noSteps')}</p> : null}
      <ul className="mt-3 grid gap-2">
        {template.steps.map((item) => (
          <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-paper-deep px-3 py-2">
            <span className={item.status === 'skipped' ? 'text-ink-soft line-through' : ''}>
              {item.position}. {item.body}
            </span>
            {canManage ? (
              <Button type="button" variant="ghost" onClick={() => void setStatus(item.id, item.status === 'skipped' ? 'active' : 'skipped')}>
                {item.status === 'skipped' ? t('tasks.restore') : t('tasks.skip')}
              </Button>
            ) : (
              <span className="text-sm text-ink-soft">{item.status === 'skipped' ? t('tasks.skipped') : ''}</span>
            )}
          </li>
        ))}
      </ul>
      {error ? <Alert>{error}</Alert> : null}
      {canManage ? (
        <form className="mt-3 grid gap-2" onSubmit={step.handleSubmit((values) => stepMutation.mutate(values))}>
          <Field id={`step-${template.id}`} label={t('tasks.stepBody')} error={text(t, step.formState.errors.body?.message)}>
            <Input id={`step-${template.id}`} {...step.register('body')} />
          </Field>
          <Button type="submit" variant="outline">
            {stepMutation.isPending ? t('tasks.saving') : t('tasks.addStep')}
          </Button>
          {stepMutation.isError ? <Alert>{explain(stepMutation.error, t)}</Alert> : null}
        </form>
      ) : null}
    </Card>
  );
}

function TaskForm({
  farmId,
  templates,
  people,
  onDone,
}: {
  farmId: string;
  templates: TaskTemplate[];
  people: Member[];
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const form = useForm<z.infer<typeof taskInputSchema>>({
    resolver: zodResolver(taskInputSchema),
    defaultValues: { title: '', dueOn: '', instructions: '', assigneeUserId: '', proofRequired: false, templateId: '' },
  });
  const mutation = useMutation({
    mutationFn: (values: z.infer<typeof taskInputSchema>) => api(`/api/v1/farms/${farmId}/tasks`, { method: 'POST', json: values }),
    onSuccess: onDone,
  });

  return (
    <Card>
      <form className="grid gap-3" onSubmit={form.handleSubmit((values) => mutation.mutate(values))}>
        <h2 className="font-display text-2xl">{t('tasks.add')}</h2>
        <Field id="task-title" label={t('tasks.titleField')} error={text(t, form.formState.errors.title?.message)}>
          <Input id="task-title" {...form.register('title')} />
        </Field>
        <Field id="task-due" label={t('tasks.due')} error={text(t, form.formState.errors.dueOn?.message)}>
          <Input id="task-due" type="date" {...form.register('dueOn')} />
        </Field>
        <Field id="task-instructions" label={`${t('tasks.instructions')} (${t('common.optional')})`} error={text(t, form.formState.errors.instructions?.message)}>
          <TextArea id="task-instructions" {...form.register('instructions')} />
        </Field>
        <Field id="task-assignee" label={`${t('tasks.assignee')} (${t('common.optional')})`}>
          <select id="task-assignee" className={selectClass} {...form.register('assigneeUserId')}>
            <option value="">{t('tasks.unassigned')}</option>
            {people.map((person) => (
              <option key={person.userId} value={person.userId}>
                {person.displayName}
              </option>
            ))}
          </select>
        </Field>
        <Field id="task-template" label={`${t('tasks.template')} (${t('common.optional')})`}>
          <select id="task-template" className={selectClass} {...form.register('templateId')}>
            <option value="">{t('tasks.none')}</option>
            {templates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name}
              </option>
            ))}
          </select>
        </Field>
        <label className="flex min-h-11 items-center gap-2 text-sm font-semibold" htmlFor="task-proof">
          <input id="task-proof" type="checkbox" {...form.register('proofRequired')} />
          {t('tasks.proof')}
        </label>
        {mutation.isError ? <Alert>{explain(mutation.error, t)}</Alert> : null}
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? t('tasks.saving') : t('tasks.save')}
        </Button>
      </form>
    </Card>
  );
}

export function TaskDetailPage() {
  const { farmId = '', taskId = '' } = useParams();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const farms = useQuery({ queryKey: ['farms'], queryFn: () => api<FarmSummary[]>('/api/v1/farms') });
  const access = farms.data?.find((farm) => farm.id === farmId);
  const task = useQuery({
    queryKey: ['task', farmId, taskId],
    queryFn: () => api<FarmTask>(`/api/v1/farms/${farmId}/tasks/${taskId}`),
  });
  const canComplete = Boolean(access?.permissions.includes('task.complete') && task.data?.status === 'open');
  const form = useForm<z.infer<typeof taskCompleteSchema>>({ resolver: zodResolver(taskCompleteSchema), defaultValues: { note: '' } });
  const mutation = useMutation({
    mutationFn: (values: z.infer<typeof taskCompleteSchema>) =>
      api(`/api/v1/farms/${farmId}/tasks/${taskId}/complete`, { method: 'POST', json: values }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['task', farmId, taskId] });
      void queryClient.invalidateQueries({ queryKey: ['tasks', farmId] });
    },
  });

  if (task.isLoading) return <p>{t('common.loading')}</p>;
  if (task.isError || !task.data) return <Alert>{explain(task.error, t)}</Alert>;
  const item = task.data;

  return (
    <div className="grid gap-4">
      <div>
        <h1 className="font-display text-3xl font-semibold">{item.title}</h1>
        <p className="mt-1 text-ink-soft">
          {item.dueOn} · {t(`tasks.status.${item.status}`)}
          {item.overdue ? ` · ${t('tasks.overdue')}` : ''}
          {item.assigneeName ? ` · ${item.assigneeName}` : ''}
        </p>
      </div>
      {item.instructions ? <p>{item.instructions}</p> : null}
      <section className="grid gap-2">
        <h2 className="font-display text-2xl">{t('tasks.checklist')}</h2>
        {item.steps.length === 0 ? <p className="text-ink-soft">{t('tasks.copiedEmpty')}</p> : null}
        <ol className="grid gap-2">
          {item.steps.map((step) => (
            <li key={step.position} className="rounded-xl bg-paper-deep px-3 py-2">
              {step.position}. {step.body}
            </li>
          ))}
        </ol>
      </section>
      {item.status === 'done' ? (
        <Card>
          <p className="font-semibold">{t('tasks.status.done')}</p>
          {item.completionNote ? <p className="mt-1">{item.completionNote}</p> : <p className="mt-1 text-ink-soft">{t('tasks.doneWithoutNote')}</p>}
        </Card>
      ) : null}
      {canComplete ? (
        <Card>
          <form className="grid gap-3" onSubmit={form.handleSubmit((values) => mutation.mutate(values))}>
            <h2 className="font-display text-2xl">{t('tasks.complete')}</h2>
            <Field
              id="task-note"
              label={item.proofRequired ? t('tasks.note') : `${t('tasks.note')} (${t('common.optional')})`}
              error={text(t, form.formState.errors.note?.message)}
            >
              <TextArea id="task-note" {...form.register('note')} />
            </Field>
            {item.proofRequired ? <p className="text-sm text-ink-soft">{t('tasks.noteRequired')}</p> : null}
            {mutation.isError ? <Alert>{explain(mutation.error, t)}</Alert> : null}
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? t('tasks.saving') : t('tasks.complete')}
            </Button>
          </form>
        </Card>
      ) : null}
    </div>
  );
}
