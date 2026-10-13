import { customerInputSchema, marketPriceInputSchema, orderInputSchema } from '@gavran/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { z } from 'zod';
import { Alert, Button, Card, Field, Input, TextArea } from '@/components/ui';
import { ApiError, api, errorKey } from '@/lib/api';
import type { Customer, FarmOrder, FarmSummary, MarketPrice, OrdersPage } from '@/lib/types';

const selectClass = 'min-h-11 w-full rounded-xl border border-line bg-white px-3';

function text(t: (key: string, options?: { defaultValue?: string }) => string, code?: string) {
  if (!code) return undefined;
  return t(`validation.${code}`, { defaultValue: t('validation.invalid') });
}

function explain(error: unknown, t: (key: string) => string) {
  if (error instanceof ApiError) {
    if (error.status === 403) return t('common.permissionDenied');
    if (error.status === 404) return t('farm.notFound');
    if (error.code === 'DUPLICATE_CODE') return t('sales.duplicate');
    const key = errorKey(error);
    return key ? t(key) : t('common.errorGeneric');
  }
  return t('common.errorGeneric');
}

export function SalesPage() {
  const { farmId = '' } = useParams();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const farms = useQuery({ queryKey: ['farms'], queryFn: () => api<FarmSummary[]>('/api/v1/farms') });
  const access = farms.data?.find((farm) => farm.id === farmId);
  const canRecord = Boolean(access?.permissions.includes('sale.record'));
  const prices = useQuery({ queryKey: ['market-prices', farmId], queryFn: () => api<MarketPrice[]>(`/api/v1/farms/${farmId}/market-prices`) });
  const customers = useQuery({ queryKey: ['customers', farmId], queryFn: () => api<Customer[]>(`/api/v1/farms/${farmId}/customers`) });
  const orders = useQuery({ queryKey: ['orders', farmId], queryFn: () => api<OrdersPage>(`/api/v1/farms/${farmId}/orders`) });

  if (prices.isLoading || customers.isLoading || orders.isLoading) return <p>{t('common.loading')}</p>;
  if (prices.isError || customers.isError || orders.isError || !prices.data || !customers.data || !orders.data) {
    return <Alert>{explain(prices.error ?? customers.error ?? orders.error, t)}</Alert>;
  }

  return (
    <div className="grid gap-4">
      <div>
        <h1 className="font-display text-3xl font-semibold">{t('sales.title')}</h1>
        <p className="mt-1 text-ink-soft">{t('sales.body')}</p>
      </div>
      <p className="rounded-xl bg-gold/30 px-3 py-2 text-sm" role="status">
        {t('sales.invoiceOff')}
      </p>
      <PriceList prices={prices.data} canRecord={canRecord} farmId={farmId} onSaved={() => void queryClient.invalidateQueries({ queryKey: ['market-prices', farmId] })} />
      <CustomerList customers={customers.data} canRecord={canRecord} farmId={farmId} onSaved={() => void queryClient.invalidateQueries({ queryKey: ['customers', farmId] })} />
      <OrderList
        orders={orders.data.orders}
        customers={customers.data}
        canRecord={canRecord}
        farmId={farmId}
        onSaved={() => void queryClient.invalidateQueries({ queryKey: ['orders', farmId] })}
      />
    </div>
  );
}

function PriceList({ prices, canRecord, farmId, onSaved }: { prices: MarketPrice[]; canRecord: boolean; farmId: string; onSaved: () => void }) {
  const { t } = useTranslation();
  const form = useForm<z.infer<typeof marketPriceInputSchema>>({
    resolver: zodResolver(marketPriceInputSchema),
    defaultValues: { itemName: '', amount: '' as unknown as number, unitLabel: '', effectiveOn: '' },
  });
  const mutation = useMutation({
    mutationFn: (values: z.infer<typeof marketPriceInputSchema>) => api(`/api/v1/farms/${farmId}/market-prices`, { method: 'POST', json: values }),
    onSuccess: () => {
      form.reset({ itemName: '', amount: '' as unknown as number, unitLabel: '', effectiveOn: '' });
      onSaved();
    },
  });
  return (
    <section className="grid gap-3">
      <h2 className="font-display text-2xl">{t('sales.pricesTitle')}</h2>
      {prices.length === 0 ? (
        <Card>
          <h3 className="font-display text-xl">{t('sales.pricesEmptyTitle')}</h3>
          <p className="text-ink-soft">{t('sales.pricesEmptyBody')}</p>
        </Card>
      ) : (
        prices.map((price) => (
          <Card key={price.id}>
            <p className="font-semibold">{price.itemName}</p>
            <p>
              {price.amount} {price.unitLabel}
            </p>
            <p className="text-sm text-ink-soft">{price.effectiveOn}</p>
          </Card>
        ))
      )}
      {canRecord ? (
        <Card>
          <form className="grid gap-3" onSubmit={form.handleSubmit((values) => mutation.mutate({ ...values, amount: Number(values.amount) }))}>
            <h3 className="font-display text-xl">{t('sales.savePrice')}</h3>
            <Field id="price-item" label={t('sales.item')} error={text(t, form.formState.errors.itemName?.message)}>
              <Input id="price-item" {...form.register('itemName')} />
            </Field>
            <Field id="price-amount" label={t('sales.amount')} error={text(t, form.formState.errors.amount?.message)}>
              <Input id="price-amount" type="number" min={0} step="0.01" {...form.register('amount', { valueAsNumber: true })} />
            </Field>
            <Field id="price-unit" label={t('sales.unit')} error={text(t, form.formState.errors.unitLabel?.message)}>
              <Input id="price-unit" {...form.register('unitLabel')} />
            </Field>
            <Field id="price-date" label={t('sales.date')} error={text(t, form.formState.errors.effectiveOn?.message)}>
              <Input id="price-date" type="date" {...form.register('effectiveOn')} />
            </Field>
            {mutation.isError ? <Alert>{explain(mutation.error, t)}</Alert> : null}
            <Button type="submit">{mutation.isPending ? t('sales.saving') : t('sales.savePrice')}</Button>
          </form>
        </Card>
      ) : null}
    </section>
  );
}

function CustomerList({ customers, canRecord, farmId, onSaved }: { customers: Customer[]; canRecord: boolean; farmId: string; onSaved: () => void }) {
  const { t } = useTranslation();
  const form = useForm<z.infer<typeof customerInputSchema>>({
    resolver: zodResolver(customerInputSchema),
    defaultValues: { name: '', phone: '', notes: '' },
  });
  const mutation = useMutation({
    mutationFn: (values: z.infer<typeof customerInputSchema>) => api(`/api/v1/farms/${farmId}/customers`, { method: 'POST', json: values }),
    onSuccess: () => {
      form.reset({ name: '', phone: '', notes: '' });
      onSaved();
    },
  });
  return (
    <section className="grid gap-3">
      <h2 className="font-display text-2xl">{t('sales.customersTitle')}</h2>
      {customers.length === 0 ? <Card><p>{t('sales.customersEmpty')}</p></Card> : customers.map((customer) => (
        <Card key={customer.id}>
          <p className="font-semibold">{customer.name}</p>
          {customer.phone ? <p className="text-sm text-ink-soft">{customer.phone}</p> : null}
          {customer.notes ? <p>{customer.notes}</p> : null}
        </Card>
      ))}
      {canRecord ? (
        <Card>
          <form className="grid gap-3" onSubmit={form.handleSubmit((values) => mutation.mutate(values))}>
            <h3 className="font-display text-xl">{t('sales.saveCustomer')}</h3>
            <Field id="customer-name" label={t('sales.name')} error={text(t, form.formState.errors.name?.message)}>
              <Input id="customer-name" {...form.register('name')} />
            </Field>
            <Field id="customer-phone" label={`${t('sales.phone')} (${t('common.optional')})`}>
              <Input id="customer-phone" {...form.register('phone')} />
            </Field>
            <Field id="customer-notes" label={`${t('sales.notes')} (${t('common.optional')})`}>
              <TextArea id="customer-notes" {...form.register('notes')} />
            </Field>
            {mutation.isError ? <Alert>{explain(mutation.error, t)}</Alert> : null}
            <Button type="submit">{mutation.isPending ? t('sales.saving') : t('sales.saveCustomer')}</Button>
          </form>
        </Card>
      ) : null}
    </section>
  );
}

function OrderList({
  orders,
  customers,
  canRecord,
  farmId,
  onSaved,
}: {
  orders: FarmOrder[];
  customers: Customer[];
  canRecord: boolean;
  farmId: string;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const form = useForm<z.infer<typeof orderInputSchema>>({
    resolver: zodResolver(orderInputSchema),
    defaultValues: {
      customerId: '',
      orderedOn: '',
      lines: [{ description: '', quantity: '' as unknown as number, unitPrice: '' as unknown as number }],
    },
  });
  const mutation = useMutation({
    mutationFn: (values: z.infer<typeof orderInputSchema>) => api(`/api/v1/farms/${farmId}/orders`, { method: 'POST', json: values }),
    onSuccess: () => {
      form.reset({
        customerId: '',
        orderedOn: '',
        lines: [{ description: '', quantity: '' as unknown as number, unitPrice: '' as unknown as number }],
      });
      onSaved();
    },
  });
  return (
    <section className="grid gap-3">
      <h2 className="font-display text-2xl">{t('sales.ordersTitle')}</h2>
      {orders.length === 0 ? <Card><p>{t('sales.ordersEmpty')}</p></Card> : orders.map((order) => (
        <Card key={order.id}>
          <p className="font-semibold">
            {order.orderedOn} · {order.customerName} · {t('sales.statusDraft')}
          </p>
          <ul className="mt-2 grid gap-1 text-sm">
            {order.lines.map((line, index) => (
              <li key={`${order.id}-${index}`}>
                {line.description} · {line.quantity} · {line.unitPrice}
              </li>
            ))}
          </ul>
        </Card>
      ))}
      {canRecord && customers.length === 0 ? <p className="text-sm text-ink-soft">{t('sales.needCustomer')}</p> : null}
      {canRecord && customers.length > 0 ? (
        <Card>
          <form
            className="grid gap-3"
            onSubmit={form.handleSubmit((values) =>
              mutation.mutate({
                ...values,
                lines: values.lines.map((line) => ({ ...line, quantity: Number(line.quantity), unitPrice: Number(line.unitPrice) })),
              }),
            )}
          >
            <h3 className="font-display text-xl">{t('sales.saveOrder')}</h3>
            <Field id="order-customer" label={t('sales.customer')} error={text(t, form.formState.errors.customerId?.message)}>
              <select id="order-customer" className={selectClass} {...form.register('customerId')}>
                <option value="">{t('sales.chooseCustomer')}</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field id="order-date" label={t('sales.date')} error={text(t, form.formState.errors.orderedOn?.message)}>
              <Input id="order-date" type="date" {...form.register('orderedOn')} />
            </Field>
            <Field id="order-description" label={t('sales.description')} error={text(t, form.formState.errors.lines?.[0]?.description?.message)}>
              <Input id="order-description" {...form.register('lines.0.description')} />
            </Field>
            <Field id="order-quantity" label={t('sales.quantity')} error={text(t, form.formState.errors.lines?.[0]?.quantity?.message)}>
              <Input id="order-quantity" type="number" min={0} step="0.001" {...form.register('lines.0.quantity', { valueAsNumber: true })} />
            </Field>
            <Field id="order-price" label={t('sales.unitPrice')} error={text(t, form.formState.errors.lines?.[0]?.unitPrice?.message)}>
              <Input id="order-price" type="number" min={0} step="0.01" {...form.register('lines.0.unitPrice', { valueAsNumber: true })} />
            </Field>
            {mutation.isError ? <Alert>{explain(mutation.error, t)}</Alert> : null}
            <Button type="submit">{mutation.isPending ? t('sales.saving') : t('sales.saveOrder')}</Button>
          </form>
        </Card>
      ) : null}
    </section>
  );
}
