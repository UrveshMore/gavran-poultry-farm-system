import { goodsReceiptInputSchema, purchaseOrderInputSchema, supplierBillInputSchema, supplierInputSchema, supplierPaymentInputSchema } from '@gavran/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { z } from 'zod';
import { Alert, Button, Card, Field, Input, TextArea } from '@/components/ui';
import { ApiError, api, errorKey } from '@/lib/api';
import type { FarmSummary, SupplierPage } from '@/lib/types';
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

function money(amount: number, unit: string) {
  return `${amount} ${unit}`;
}

export function SuppliersPage() {
  const { farmId = '' } = useParams();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const farms = useQuery({ queryKey: ['farms'], queryFn: () => api<FarmSummary[]>('/api/v1/farms') });
  const access = farms.data?.find((farm) => farm.id === farmId);
  const page = useQuery({ queryKey: ['suppliers', farmId], queryFn: () => api<SupplierPage>(`/api/v1/farms/${farmId}/suppliers`) });
  const canRecord = Boolean(access?.permissions.includes('supplier.record'));
  const refresh = () => void queryClient.invalidateQueries({ queryKey: ['suppliers', farmId] });

  const supplierForm = useForm<z.infer<typeof supplierInputSchema>>({
    resolver: zodResolver(supplierInputSchema),
    defaultValues: { name: '', contactName: '', phone: '', notes: '' },
  });
  const orderForm = useForm<z.infer<typeof purchaseOrderInputSchema>>({
    resolver: zodResolver(purchaseOrderInputSchema),
    defaultValues: { supplierId: '', orderedOn: localToday(), notes: '', lines: [{ description: '', quantity: 1, unitLabel: '', unitPrice: null, priceUnit: '' }] },
  });
  const receiptForm = useForm<z.infer<typeof goodsReceiptInputSchema>>({
    resolver: zodResolver(goodsReceiptInputSchema),
    defaultValues: { supplierId: '', purchaseOrderId: '', receivedOn: localToday(), acceptedQuantity: 0, rejectedQuantity: 0, unitLabel: '', note: '' },
  });
  const billForm = useForm<z.infer<typeof supplierBillInputSchema>>({
    resolver: zodResolver(supplierBillInputSchema),
    defaultValues: { supplierId: '', billedOn: localToday(), amount: 0, unitLabel: '', referenceNote: '', notes: '' },
  });
  const payForm = useForm<z.infer<typeof supplierPaymentInputSchema>>({
    resolver: zodResolver(supplierPaymentInputSchema),
    defaultValues: { supplierId: '', paidOn: localToday(), amount: 0, unitLabel: '', referenceNote: '', notes: '' },
  });

  const saveSupplier = useMutation({
    mutationFn: (values: z.infer<typeof supplierInputSchema>) => api(`/api/v1/farms/${farmId}/suppliers`, { method: 'POST', json: values }),
    onSuccess: () => { supplierForm.reset(); refresh(); },
  });
  const saveOrder = useMutation({
    mutationFn: (values: z.infer<typeof purchaseOrderInputSchema>) => api(`/api/v1/farms/${farmId}/purchase-orders`, { method: 'POST', json: values }),
    onSuccess: () => { orderForm.reset({ supplierId: '', orderedOn: localToday(), notes: '', lines: [{ description: '', quantity: 1, unitLabel: '', unitPrice: null, priceUnit: '' }] }); refresh(); },
  });
  const saveReceipt = useMutation({
    mutationFn: (values: z.infer<typeof goodsReceiptInputSchema>) => api(`/api/v1/farms/${farmId}/goods-receipts`, { method: 'POST', json: values }),
    onSuccess: () => { receiptForm.reset({ supplierId: '', purchaseOrderId: '', receivedOn: localToday(), acceptedQuantity: 0, rejectedQuantity: 0, unitLabel: '', note: '' }); refresh(); },
  });
  const saveBill = useMutation({
    mutationFn: (values: z.infer<typeof supplierBillInputSchema>) => api(`/api/v1/farms/${farmId}/supplier-bills`, { method: 'POST', json: values }),
    onSuccess: () => { billForm.reset({ supplierId: '', billedOn: localToday(), amount: 0, unitLabel: '', referenceNote: '', notes: '' }); refresh(); },
  });
  const savePayment = useMutation({
    mutationFn: (values: z.infer<typeof supplierPaymentInputSchema>) => api(`/api/v1/farms/${farmId}/supplier-payments`, { method: 'POST', json: values }),
    onSuccess: () => { payForm.reset({ supplierId: '', paidOn: localToday(), amount: 0, unitLabel: '', referenceNote: '', notes: '' }); refresh(); },
  });

  if (page.isLoading) return <p>{t('common.loading')}</p>;
  if (page.isError || !page.data) return <Alert>{explain(page.error, t)}</Alert>;
  const data = page.data;
  const options = data.suppliers.map((supplier) => (
    <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
  ));

  return (
    <div className="grid gap-4">
      <div>
        <h1 className="font-display text-3xl font-semibold">{t('suppliers.title')}</h1>
        <p className="mt-1 text-ink-soft">{t('suppliers.body')}</p>
      </div>
      <p className="rounded-xl bg-gold/30 px-3 py-2 text-sm">{t('suppliers.noStock')}</p>
      {data.suppliers.length === 0 ? (
        <Card>
          <h2 className="font-display text-2xl">{t('suppliers.emptyTitle')}</h2>
          <p className="text-ink-soft">{t('suppliers.emptyBody')}</p>
        </Card>
      ) : (
        data.suppliers.map((supplier) => (
          <Card key={supplier.id}>
            <p className="font-semibold">{supplier.name}</p>
            {supplier.contactName ? <p>{supplier.contactName}</p> : null}
            {supplier.notes ? <p className="text-sm text-ink-soft">{supplier.notes}</p> : null}
          </Card>
        ))
      )}
      {data.orders.map((order) => (
        <Card key={order.id}>
          <p className="font-semibold">{order.supplierName} · {order.orderedOn} · {t('suppliers.draft')}</p>
          {order.lines.map((line) => (
            <p key={line.id}>
              {line.description} · {line.quantity} {line.unitLabel}
              {line.unitPrice === null ? ` · ${t('suppliers.priceBlank')}` : ` · ${money(line.unitPrice, line.priceUnit ?? '')}`}
            </p>
          ))}
        </Card>
      ))}
      {data.receipts.map((row) => (
        <Card key={row.id}>
          <p className="font-semibold">{row.supplierName} · {row.receivedOn}</p>
          <p>{t('suppliers.accepted', { count: row.acceptedQuantity, unit: row.unitLabel })}</p>
          <p>{t('suppliers.rejected', { count: row.rejectedQuantity, unit: row.unitLabel })}</p>
        </Card>
      ))}
      {data.bills.map((row) => (
        <Card key={row.id}><p>{t('suppliers.billLine', { name: row.supplierName, amount: money(row.amount, row.unitLabel), date: row.occurredOn })}</p></Card>
      ))}
      {data.payments.map((row) => (
        <Card key={row.id}><p>{t('suppliers.payLine', { name: row.supplierName, amount: money(row.amount, row.unitLabel), date: row.occurredOn })}</p></Card>
      ))}
      {canRecord ? (
        <>
          <Card>
            <form className="grid gap-3" onSubmit={supplierForm.handleSubmit((values) => saveSupplier.mutate(values))}>
              <h2 className="font-display text-2xl">{t('suppliers.add')}</h2>
              <Field id="sup-name" label={t('suppliers.name')} hint={t('fieldHint.sup-name')}><Input id="sup-name" {...supplierForm.register('name')}  placeholder={t('fieldPh.sup-name')}/></Field>
              <Field id="sup-contact" label={`${t('suppliers.contact')} (${t('common.optional')})`} hint={t('fieldHint.sup-contact')}><Input id="sup-contact" {...supplierForm.register('contactName')}  placeholder={t('fieldPh.sup-contact')}/></Field>
              <Field id="sup-phone" label={`${t('suppliers.phone')} (${t('common.optional')})`} hint={t('fieldHint.sup-phone')}><Input id="sup-phone" {...supplierForm.register('phone')}  placeholder={t('fieldPh.sup-phone')}/></Field>
              <Field id="sup-notes" label={`${t('suppliers.note')} (${t('common.optional')})`} hint={t('fieldHint.sup-notes')}><TextArea id="sup-notes" {...supplierForm.register('notes')}  placeholder={t('fieldPh.sup-notes')}/></Field>
              {saveSupplier.isError ? <Alert>{explain(saveSupplier.error, t)}</Alert> : null}
              <Button type="submit">{saveSupplier.isPending ? t('suppliers.saving') : t('suppliers.save')}</Button>
            </form>
          </Card>
          {data.suppliers.length > 0 ? (
            <Card>
              <form className="grid gap-3" onSubmit={orderForm.handleSubmit((values) => saveOrder.mutate(values))}>
                <h2 className="font-display text-2xl">{t('suppliers.order')}</h2>
                <Field id="po-supplier" label={t('suppliers.name')} hint={t('fieldHint.po-supplier')}>
                  <select id="po-supplier" className={selectClass} {...orderForm.register('supplierId')}>
                    <option value="">{t('suppliers.choose')}</option>
                    {options}
                  </select>
                </Field>
                <Field id="po-date" label={t('suppliers.date')} hint={t('fieldHint.po-date')}><Input id="po-date" type="date" allowFuture {...orderForm.register('orderedOn')} /></Field>
                <Field id="po-desc" label={t('suppliers.line')} hint={t('fieldHint.po-desc')}><Input id="po-desc" {...orderForm.register('lines.0.description')}  placeholder={t('fieldPh.po-desc')}/></Field>
                <Field id="po-qty" label={t('suppliers.quantity')} hint={t('fieldHint.po-qty')}><Input id="po-qty" type="number" min={0} step="any" {...orderForm.register('lines.0.quantity', { valueAsNumber: true })}  placeholder={t('fieldPh.po-qty')}/></Field>
                <Field id="po-unit" label={t('suppliers.unit')} hint={t('fieldHint.po-unit')}><Input id="po-unit" {...orderForm.register('lines.0.unitLabel')}  placeholder={t('fieldPh.po-unit')}/></Field>
                <Field id="po-price" label={`${t('suppliers.price')} (${t('common.optional')})`} hint={t('suppliers.priceHint')}>
                  <Input id="po-price" type="number" min={0} step="any" {...orderForm.register('lines.0.unitPrice', { setValueAs: (value) => (value === '' || value === null ? null : Number(value)) })} />
                </Field>
                <Field id="po-price-unit" label={`${t('suppliers.priceUnit')} (${t('common.optional')})`} hint={t('fieldHint.po-price-unit')}>
                  <Input id="po-price-unit" {...orderForm.register('lines.0.priceUnit')}  placeholder={t('fieldPh.po-price-unit')}/>
                </Field>
                {saveOrder.isError ? <Alert>{explain(saveOrder.error, t)}</Alert> : null}
                <Button type="submit">{saveOrder.isPending ? t('suppliers.saving') : t('suppliers.saveOrder')}</Button>
              </form>
            </Card>
          ) : null}
          {data.suppliers.length > 0 ? (
            <Card>
              <form className="grid gap-3" onSubmit={receiptForm.handleSubmit((values) => saveReceipt.mutate(values))}>
                <h2 className="font-display text-2xl">{t('suppliers.receipt')}</h2>
                <Field id="gr-supplier" label={t('suppliers.name')} hint={t('fieldHint.gr-supplier')}>
                  <select id="gr-supplier" className={selectClass} {...receiptForm.register('supplierId')}>
                    <option value="">{t('suppliers.choose')}</option>
                    {options}
                  </select>
                </Field>
                <Field id="gr-date" label={t('suppliers.date')} hint={t('fieldHint.gr-date')}><Input id="gr-date" type="date" {...receiptForm.register('receivedOn')} /></Field>
                <Field id="gr-ok" label={t('suppliers.acceptedLabel')} hint={t('fieldHint.gr-ok')}><Input id="gr-ok" type="number" min={0} step="any" {...receiptForm.register('acceptedQuantity', { valueAsNumber: true })}  placeholder={t('fieldPh.gr-ok')}/></Field>
                <Field id="gr-bad" label={t('suppliers.rejectedLabel')} hint={t('fieldHint.gr-bad')}><Input id="gr-bad" type="number" min={0} step="any" {...receiptForm.register('rejectedQuantity', { valueAsNumber: true })}  placeholder={t('fieldPh.gr-bad')}/></Field>
                <Field id="gr-unit" label={t('suppliers.unit')} hint={t('fieldHint.gr-unit')}><Input id="gr-unit" {...receiptForm.register('unitLabel')}  placeholder={t('fieldPh.gr-unit')}/></Field>
                <Field id="gr-note" label={`${t('suppliers.note')} (${t('common.optional')})`} hint={t('fieldHint.gr-note')}><TextArea id="gr-note" {...receiptForm.register('note')}  placeholder={t('fieldPh.gr-note')}/></Field>
                {saveReceipt.isError ? <Alert>{explain(saveReceipt.error, t)}</Alert> : null}
                <Button type="submit">{saveReceipt.isPending ? t('suppliers.saving') : t('suppliers.saveReceipt')}</Button>
              </form>
            </Card>
          ) : null}
          {data.suppliers.length > 0 ? (
            <Card>
              <form className="grid gap-3" onSubmit={billForm.handleSubmit((values) => saveBill.mutate({ ...values, amount: Number(values.amount) }))}>
                <h2 className="font-display text-2xl">{t('suppliers.bill')}</h2>
                <Field id="bill-supplier" label={t('suppliers.name')} hint={t('fieldHint.bill-supplier')}>
                  <select id="bill-supplier" className={selectClass} {...billForm.register('supplierId')}>
                    <option value="">{t('suppliers.choose')}</option>
                    {options}
                  </select>
                </Field>
                <Field id="bill-date" label={t('suppliers.date')} hint={t('fieldHint.bill-date')}><Input id="bill-date" type="date" {...billForm.register('billedOn')} /></Field>
                <Field id="bill-amount" label={t('suppliers.amount')} hint={t('fieldHint.bill-amount')}><Input id="bill-amount" type="number" min={0} step="any" {...billForm.register('amount', { valueAsNumber: true })}  placeholder={t('fieldPh.bill-amount')}/></Field>
                <Field id="bill-unit" label={t('suppliers.unit')} hint={t('suppliers.unitHint')}><Input id="bill-unit" {...billForm.register('unitLabel')}  placeholder={t('fieldPh.bill-unit')}/></Field>
                <Field id="bill-ref" label={`${t('suppliers.reference')} (${t('common.optional')})`} hint={t('fieldHint.bill-ref')}><Input id="bill-ref" {...billForm.register('referenceNote')}  placeholder={t('fieldPh.bill-ref')}/></Field>
                {saveBill.isError ? <Alert>{explain(saveBill.error, t)}</Alert> : null}
                <Button type="submit">{saveBill.isPending ? t('suppliers.saving') : t('suppliers.saveBill')}</Button>
              </form>
            </Card>
          ) : null}
          {data.suppliers.length > 0 ? (
            <Card>
              <form className="grid gap-3" onSubmit={payForm.handleSubmit((values) => savePayment.mutate({ ...values, amount: Number(values.amount) }))}>
                <h2 className="font-display text-2xl">{t('suppliers.payment')}</h2>
                <p className="text-sm text-ink-soft">{t('suppliers.paymentHint')}</p>
                <Field id="pay-supplier" label={t('suppliers.name')} hint={t('fieldHint.pay-supplier')}>
                  <select id="pay-supplier" className={selectClass} {...payForm.register('supplierId')}>
                    <option value="">{t('suppliers.choose')}</option>
                    {options}
                  </select>
                </Field>
                <Field id="pay-date" label={t('suppliers.date')} hint={t('fieldHint.pay-date')}><Input id="pay-date" type="date" {...payForm.register('paidOn')} /></Field>
                <Field id="pay-amount" label={t('suppliers.amount')} hint={t('fieldHint.pay-amount')}><Input id="pay-amount" type="number" min={0} step="any" {...payForm.register('amount', { valueAsNumber: true })}  placeholder={t('fieldPh.pay-amount')}/></Field>
                <Field id="pay-unit" label={t('suppliers.unit')} hint={t('fieldHint.pay-unit')}><Input id="pay-unit" {...payForm.register('unitLabel')}  placeholder={t('fieldPh.pay-unit')}/></Field>
                {savePayment.isError ? <Alert>{explain(savePayment.error, t)}</Alert> : null}
                <Button type="submit">{savePayment.isPending ? t('suppliers.saving') : t('suppliers.savePayment')}</Button>
              </form>
            </Card>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
