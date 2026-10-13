import { expenseCategoryInputSchema, expenseEntryInputSchema, expenseReversalSchema } from '@gavran/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { z } from 'zod';
import { Alert, Button, Card, Field, Input, TextArea } from '@/components/ui';
import { ApiError, api, errorKey } from '@/lib/api';
import type { Batch, ExpenseEntry, ExpensesPageData, FarmSummary } from '@/lib/types';

const selectClass = 'min-h-11 w-full rounded-xl border border-line bg-white px-3';

function text(t: (key: string, options?: { defaultValue?: string }) => string, code?: string) {
  if (!code) return undefined;
  return t(`validation.${code}`, { defaultValue: t('validation.invalid') });
}

function explain(error: unknown, t: (key: string) => string) {
  if (error instanceof ApiError) {
    if (error.status === 403) return t('common.permissionDenied');
    if (error.status === 404) return t('farm.notFound');
    if (error.code === 'DUPLICATE_CODE') return t('expenses.duplicate');
    const key = errorKey(error);
    return key ? t(key) : t('common.errorGeneric');
  }
  return t('common.errorGeneric');
}

export function ExpensesPage() {
  const { farmId = '' } = useParams();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const farms = useQuery({ queryKey: ['farms'], queryFn: () => api<FarmSummary[]>('/api/v1/farms') });
  const access = farms.data?.find((farm) => farm.id === farmId);
  const canRecord = Boolean(access?.permissions.includes('expense.record'));
  const page = useQuery({ queryKey: ['expenses', farmId], queryFn: () => api<ExpensesPageData>(`/api/v1/farms/${farmId}/expenses`) });
  const batches = useQuery({ queryKey: ['batches', farmId], queryFn: () => api<Batch[]>(`/api/v1/farms/${farmId}/batches`) });
  const refresh = () => void queryClient.invalidateQueries({ queryKey: ['expenses', farmId] });

  if (page.isLoading) return <p>{t('common.loading')}</p>;
  if (page.isError || !page.data) return <Alert>{explain(page.error, t)}</Alert>;

  return (
    <div className="grid gap-4">
      <div>
        <h1 className="font-display text-3xl font-semibold">{t('expenses.title')}</h1>
        <p className="mt-1 text-ink-soft">{t('expenses.body')}</p>
      </div>
      <p className="rounded-xl bg-gold/30 px-3 py-2 text-sm" role="status">
        {t('expenses.noBasis')}
      </p>
      <CategoryBlock farmId={farmId} categories={page.data.categories} canRecord={canRecord} onSaved={refresh} />
      <EntryBlock farmId={farmId} page={page.data} batches={batches.data ?? []} canRecord={canRecord} onSaved={refresh} />
    </div>
  );
}

function CategoryBlock({
  farmId,
  categories,
  canRecord,
  onSaved,
}: {
  farmId: string;
  categories: ExpensesPageData['categories'];
  canRecord: boolean;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const form = useForm<z.infer<typeof expenseCategoryInputSchema>>({
    resolver: zodResolver(expenseCategoryInputSchema),
    defaultValues: { name: '' },
  });
  const mutation = useMutation({
    mutationFn: (values: z.infer<typeof expenseCategoryInputSchema>) => api(`/api/v1/farms/${farmId}/expense-categories`, { method: 'POST', json: values }),
    onSuccess: () => {
      form.reset({ name: '' });
      onSaved();
    },
  });
  return (
    <section className="grid gap-3">
      <h2 className="font-display text-2xl">{t('expenses.categoriesTitle')}</h2>
      {categories.length === 0 ? (
        <Card>
          <h3 className="font-display text-xl">{t('expenses.categoriesEmptyTitle')}</h3>
          <p className="text-ink-soft">{t('expenses.categoriesEmptyBody')}</p>
        </Card>
      ) : (
        categories.map((category) => (
          <Card key={category.id}>
            <p className="font-semibold">{category.name}</p>
          </Card>
        ))
      )}
      {canRecord ? (
        <Card>
          <form className="grid gap-3" onSubmit={form.handleSubmit((values) => mutation.mutate(values))}>
            <Field id="expense-category" label={t('expenses.category')} error={text(t, form.formState.errors.name?.message)}>
              <Input id="expense-category" {...form.register('name')} />
            </Field>
            {mutation.isError ? <Alert>{explain(mutation.error, t)}</Alert> : null}
            <Button type="submit">{mutation.isPending ? t('expenses.saving') : t('expenses.saveCategory')}</Button>
          </form>
        </Card>
      ) : null}
    </section>
  );
}

function EntryBlock({
  farmId,
  page,
  batches,
  canRecord,
  onSaved,
}: {
  farmId: string;
  page: ExpensesPageData;
  batches: Batch[];
  canRecord: boolean;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const form = useForm<z.infer<typeof expenseEntryInputSchema>>({
    resolver: zodResolver(expenseEntryInputSchema),
    defaultValues: {
      occurredOn: '',
      direction: 'expense',
      categoryId: '',
      amount: '' as unknown as number,
      unitLabel: '',
      counterparty: '',
      referenceNote: '',
      notes: '',
      batchId: '',
    },
  });
  const mutation = useMutation({
    mutationFn: (values: z.infer<typeof expenseEntryInputSchema>) => api(`/api/v1/farms/${farmId}/expenses`, { method: 'POST', json: values }),
    onSuccess: () => {
      form.reset({
        occurredOn: '',
        direction: 'expense',
        categoryId: '',
        amount: '' as unknown as number,
        unitLabel: '',
        counterparty: '',
        referenceNote: '',
        notes: '',
        batchId: '',
      });
      onSaved();
    },
  });
  return (
    <section className="grid gap-3">
      <h2 className="font-display text-2xl">{t('expenses.entriesTitle')}</h2>
      {page.entries.length === 0 ? <Card><p>{t('expenses.entriesEmpty')}</p></Card> : page.entries.map((entry) => (
        <EntryCard key={entry.id} farmId={farmId} entry={entry} canRecord={canRecord} onSaved={onSaved} />
      ))}
      {canRecord && page.categories.length === 0 ? <p className="text-sm text-ink-soft">{t('expenses.needCategory')}</p> : null}
      {canRecord && page.categories.length > 0 ? (
        <Card>
          <form className="grid gap-3" onSubmit={form.handleSubmit((values) => mutation.mutate({ ...values, amount: Number(values.amount) }))}>
            <h3 className="font-display text-xl">{t('expenses.saveEntry')}</h3>
            <Field id="expense-date" label={t('expenses.date')} error={text(t, form.formState.errors.occurredOn?.message)}>
              <Input id="expense-date" type="date" {...form.register('occurredOn')} />
            </Field>
            <Field id="expense-direction" label={t('expenses.direction')}>
              <select id="expense-direction" className={selectClass} {...form.register('direction')}>
                <option value="expense">{t('expenses.expense')}</option>
                <option value="income">{t('expenses.income')}</option>
              </select>
            </Field>
            <Field id="expense-category-id" label={t('expenses.category')} error={text(t, form.formState.errors.categoryId?.message)}>
              <select id="expense-category-id" className={selectClass} {...form.register('categoryId')}>
                <option value="">{t('expenses.chooseCategory')}</option>
                {page.categories.map((category) => (
                  <option key={category.id} value={category.id}>{category.name}</option>
                ))}
              </select>
            </Field>
            <Field id="expense-amount" label={t('expenses.amount')} error={text(t, form.formState.errors.amount?.message)}>
              <Input id="expense-amount" type="number" min={0} step="0.01" {...form.register('amount', { valueAsNumber: true })} />
            </Field>
            <Field id="expense-unit" label={t('expenses.unit')} error={text(t, form.formState.errors.unitLabel?.message)}>
              <Input id="expense-unit" {...form.register('unitLabel')} />
            </Field>
            <Field id="expense-who" label={`${t('expenses.counterparty')} (${t('common.optional')})`}>
              <Input id="expense-who" {...form.register('counterparty')} />
            </Field>
            <Field id="expense-ref" label={`${t('expenses.reference')} (${t('common.optional')})`}>
              <Input id="expense-ref" {...form.register('referenceNote')} />
            </Field>
            <Field id="expense-notes" label={`${t('expenses.notes')} (${t('common.optional')})`}>
              <TextArea id="expense-notes" {...form.register('notes')} />
            </Field>
            <Field id="expense-batch" label={`${t('expenses.batch')} (${t('common.optional')})`}>
              <select id="expense-batch" className={selectClass} {...form.register('batchId')}>
                <option value="">{t('expenses.noBatch')}</option>
                {batches.map((batch) => (
                  <option key={batch.id} value={batch.id}>{batch.code}</option>
                ))}
              </select>
            </Field>
            {mutation.isError ? <Alert>{explain(mutation.error, t)}</Alert> : null}
            <Button type="submit">{mutation.isPending ? t('expenses.saving') : t('expenses.saveEntry')}</Button>
          </form>
        </Card>
      ) : null}
    </section>
  );
}

function EntryCard({ farmId, entry, canRecord, onSaved }: { farmId: string; entry: ExpenseEntry; canRecord: boolean; onSaved: () => void }) {
  const { t } = useTranslation();
  const form = useForm<z.infer<typeof expenseReversalSchema>>({
    resolver: zodResolver(expenseReversalSchema),
    defaultValues: { occurredOn: '', note: '' },
  });
  const mutation = useMutation({
    mutationFn: (values: z.infer<typeof expenseReversalSchema>) => api(`/api/v1/farms/${farmId}/expenses/${entry.id}/reversal`, { method: 'POST', json: values }),
    onSuccess: () => {
      form.reset({ occurredOn: '', note: '' });
      onSaved();
    },
  });
  return (
    <Card>
      <p className="font-semibold">
        {entry.occurredOn} · {t(entry.direction === 'income' ? 'expenses.income' : 'expenses.expense')} · {entry.categoryName}
      </p>
      <p>
        {entry.amount} {entry.unitLabel}
      </p>
      {entry.counterparty ? <p className="text-sm text-ink-soft">{entry.counterparty}</p> : null}
      {entry.notes ? <p>{entry.notes}</p> : null}
      {entry.batchCode ? <p className="text-sm text-ink-soft">{t('expenses.linked', { batch: entry.batchCode })}</p> : null}
      {entry.reversesEntryId ? <p className="text-sm">{t('expenses.reverses')}</p> : null}
      {entry.reversedById ? <p className="text-sm">{t('expenses.reversed')}</p> : null}
      {canRecord && !entry.reversedById ? (
        <form className="mt-3 grid gap-3" onSubmit={form.handleSubmit((values) => mutation.mutate(values))}>
          <Field id={`reverse-date-${entry.id}`} label={t('expenses.date')} error={text(t, form.formState.errors.occurredOn?.message)}>
            <Input id={`reverse-date-${entry.id}`} type="date" {...form.register('occurredOn')} />
          </Field>
          <Field id={`reverse-note-${entry.id}`} label={t('expenses.reverseNote')} error={text(t, form.formState.errors.note?.message)}>
            <TextArea id={`reverse-note-${entry.id}`} {...form.register('note')} />
          </Field>
          {mutation.isError ? <Alert>{explain(mutation.error, t)}</Alert> : null}
          <Button type="submit" variant="outline">{mutation.isPending ? t('expenses.saving') : t('expenses.reverse')}</Button>
        </form>
      ) : null}
    </Card>
  );
}
