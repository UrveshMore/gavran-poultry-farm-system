import { invoiceDocumentInputSchema, saleReturnInputSchema } from '@gavran/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { z } from 'zod';
import { Alert, Button, Card, Field, Input, TextArea } from '@/components/ui';
import { ApiError, api, errorKey } from '@/lib/api';
import type { Customer, FarmSummary } from '@/lib/types';
import { localToday } from '@/lib/today';

const selectClass = 'min-h-11 w-full rounded-xl border border-line bg-white px-3';

type InvoicePage = {
  documents: Array<{
    id: string;
    customerName: string;
    issuedOn: string;
    status: 'unposted';
    notes: string;
    lines: Array<{ id: string; description: string; quantity: number; unitLabel: string; unitPrice: number | null; priceUnit: string | null }>;
  }>;
  returns: Array<{ id: string; documentId: string; returnedOn: string; description: string; quantity: number; amount: number | null; unitLabel: string | null; note: string }>;
  posting: 'disabled';
  balance: { status: 'not_calculated'; reason: string };
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

export function InvoiceDocumentsPage() {
  const { farmId = '' } = useParams();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const farms = useQuery({ queryKey: ['farms'], queryFn: () => api<FarmSummary[]>('/api/v1/farms') });
  const access = farms.data?.find((farm) => farm.id === farmId);
  const page = useQuery({ queryKey: ['invoice-documents', farmId], queryFn: () => api<InvoicePage>(`/api/v1/farms/${farmId}/invoice-documents`) });
  const customers = useQuery({ queryKey: ['customers', farmId], queryFn: () => api<Customer[]>(`/api/v1/farms/${farmId}/customers`) });
  const canRecord = Boolean(access?.permissions.includes('sale.record'));
  const [returnFor, setReturnFor] = useState('');
  const refresh = () => void queryClient.invalidateQueries({ queryKey: ['invoice-documents', farmId] });
  const docForm = useForm<z.infer<typeof invoiceDocumentInputSchema>>({
    resolver: zodResolver(invoiceDocumentInputSchema),
    defaultValues: { customerId: '', orderId: '', issuedOn: localToday(), notes: '', lines: [{ description: '', quantity: 1, unitLabel: '', unitPrice: null, priceUnit: '' }] },
  });
  const returnForm = useForm<z.infer<typeof saleReturnInputSchema>>({
    resolver: zodResolver(saleReturnInputSchema),
    defaultValues: { returnedOn: localToday(), description: '', quantity: 0, amount: null, unitLabel: '', note: '' },
  });
  const saveDoc = useMutation({
    mutationFn: (values: z.infer<typeof invoiceDocumentInputSchema>) => api(`/api/v1/farms/${farmId}/invoice-documents`, { method: 'POST', json: values }),
    onSuccess: () => {
      docForm.reset({ customerId: '', orderId: '', issuedOn: localToday(), notes: '', lines: [{ description: '', quantity: 1, unitLabel: '', unitPrice: null, priceUnit: '' }] });
      refresh();
    },
  });
  const saveReturn = useMutation({
    mutationFn: (values: z.infer<typeof saleReturnInputSchema>) =>
      api(`/api/v1/farms/${farmId}/invoice-documents/${returnFor}/returns`, { method: 'POST', json: values }),
    onSuccess: () => {
      returnForm.reset({ returnedOn: localToday(), description: '', quantity: 0, amount: null, unitLabel: '', note: '' });
      setReturnFor('');
      refresh();
    },
  });

  if (page.isLoading) return <p>{t('common.loading')}</p>;
  if (page.isError || !page.data) return <Alert>{explain(page.error, t)}</Alert>;

  return (
    <div className="grid gap-4">
      <div>
        <h1 className="font-display text-3xl font-semibold">{t('invoices.title')}</h1>
        <p className="mt-1 text-ink-soft">{t('invoices.body')}</p>
      </div>
      <p className="rounded-xl bg-gold/30 px-3 py-2 text-sm">{t('invoices.unposted')}</p>
      {page.data.documents.length === 0 ? (
        <Card>
          <h2 className="font-display text-2xl">{t('invoices.emptyTitle')}</h2>
          <p className="text-ink-soft">{t('invoices.emptyBody')}</p>
        </Card>
      ) : null}
      {page.data.documents.map((doc) => (
        <Card key={doc.id}>
          <p className="font-semibold">{doc.customerName} · {doc.issuedOn} · {t('invoices.status')}</p>
          {doc.lines.map((line) => (
            <p key={line.id}>
              {line.description} · {line.quantity} {line.unitLabel}
              {line.unitPrice === null ? '' : ` · ${line.unitPrice} ${line.priceUnit ?? ''}`}
            </p>
          ))}
          {page.data.returns.filter((row) => row.documentId === doc.id).map((row) => (
            <p key={row.id} className="text-sm text-ink-soft">
              {t('invoices.returnLine', { date: row.returnedOn, text: row.description })}
              {row.amount === null ? '' : ` · ${row.amount} ${row.unitLabel ?? ''}`}
            </p>
          ))}
          {canRecord ? (
            <Button type="button" className="mt-3" onClick={() => setReturnFor(doc.id)}>{t('invoices.addReturn')}</Button>
          ) : null}
        </Card>
      ))}
      {returnFor ? (
        <Card>
          <form className="grid gap-3" onSubmit={returnForm.handleSubmit((values) => saveReturn.mutate(values))}>
            <h2 className="font-display text-2xl">{t('invoices.addReturn')}</h2>
            <Field id="ret-date" label={t('invoices.date')} hint={t('fieldHint.ret-date')}><Input id="ret-date" type="date" {...returnForm.register('returnedOn')} /></Field>
            <Field id="ret-desc" label={t('invoices.what')} hint={t('fieldHint.ret-desc')}><Input id="ret-desc" {...returnForm.register('description')}  placeholder={t('fieldPh.ret-desc')}/></Field>
            <Field id="ret-qty" label={t('invoices.quantity')} hint={t('fieldHint.ret-qty')}><Input id="ret-qty" type="number" min={0} step="any" {...returnForm.register('quantity', { valueAsNumber: true })}  placeholder={t('fieldPh.ret-qty')}/></Field>
            <Field id="ret-amount" label={`${t('invoices.amount')} (${t('common.optional')})`} hint={t('invoices.amountHint')}>
              <Input id="ret-amount" type="number" min={0} step="any" {...returnForm.register('amount', { setValueAs: (value) => (value === '' || value === null ? null : Number(value)) })} />
            </Field>
            <Field id="ret-unit" label={`${t('invoices.moneyUnit')} (${t('common.optional')})`} hint={t('fieldHint.ret-unit')}><Input id="ret-unit" {...returnForm.register('unitLabel')}  placeholder={t('fieldPh.ret-unit')}/></Field>
            <Field id="ret-note" label={`${t('invoices.note')} (${t('common.optional')})`} hint={t('fieldHint.ret-note')}><TextArea id="ret-note" {...returnForm.register('note')}  placeholder={t('fieldPh.ret-note')}/></Field>
            {saveReturn.isError ? <Alert>{explain(saveReturn.error, t)}</Alert> : null}
            <Button type="submit">{saveReturn.isPending ? t('invoices.saving') : t('invoices.saveReturn')}</Button>
          </form>
        </Card>
      ) : null}
      {canRecord ? (
        <Card>
          <form className="grid gap-3" onSubmit={docForm.handleSubmit((values) => saveDoc.mutate(values))}>
            <h2 className="font-display text-2xl">{t('invoices.add')}</h2>
            <Field id="inv-customer" label={t('invoices.customer')} hint={t('fieldHint.inv-customer')}>
              <select id="inv-customer" className={selectClass} {...docForm.register('customerId')}>
                <option value="">{t('invoices.choose')}</option>
                {(customers.data ?? []).map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}
              </select>
            </Field>
            <Field id="inv-date" label={t('invoices.date')} hint={t('fieldHint.inv-date')}><Input id="inv-date" type="date" {...docForm.register('issuedOn')} /></Field>
            <Field id="inv-desc" label={t('invoices.what')} hint={t('fieldHint.inv-desc')}><Input id="inv-desc" {...docForm.register('lines.0.description')}  placeholder={t('fieldPh.inv-desc')}/></Field>
            <Field id="inv-qty" label={t('invoices.quantity')} hint={t('fieldHint.inv-qty')}><Input id="inv-qty" type="number" min={0} step="any" {...docForm.register('lines.0.quantity', { valueAsNumber: true })}  placeholder={t('fieldPh.inv-qty')}/></Field>
            <Field id="inv-unit" label={t('invoices.unit')} hint={t('fieldHint.inv-unit')}><Input id="inv-unit" {...docForm.register('lines.0.unitLabel')}  placeholder={t('fieldPh.inv-unit')}/></Field>
            <Field id="inv-price" label={`${t('invoices.price')} (${t('common.optional')})`} hint={t('invoices.priceHint')}>
              <Input id="inv-price" type="number" min={0} step="any" {...docForm.register('lines.0.unitPrice', { setValueAs: (value) => (value === '' || value === null ? null : Number(value)) })} />
            </Field>
            <Field id="inv-price-unit" label={`${t('invoices.moneyUnit')} (${t('common.optional')})`} hint={t('fieldHint.inv-price-unit')}><Input id="inv-price-unit" {...docForm.register('lines.0.priceUnit')}  placeholder={t('fieldPh.inv-price-unit')}/></Field>
            <Field id="inv-note" label={`${t('invoices.note')} (${t('common.optional')})`} hint={t('fieldHint.inv-note')}><TextArea id="inv-note" {...docForm.register('notes')}  placeholder={t('fieldPh.inv-note')}/></Field>
            {saveDoc.isError ? <Alert>{explain(saveDoc.error, t)}</Alert> : null}
            <Button type="submit">{saveDoc.isPending ? t('invoices.saving') : t('invoices.save')}</Button>
          </form>
        </Card>
      ) : null}
    </div>
  );
}
