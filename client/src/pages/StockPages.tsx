import {
  growthTargetInputSchema,
  stockItemInputSchema,
  stockMovementInputSchema,
  waterInputSchema,
  weighingInputSchema,
} from '@gavran/shared';
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
import type { Batch, BirdType, FarmSummary, GrowthTarget, Shed, StockItem, StockMovement, WaterRecord, Weighing } from '@/lib/types';
import { localToday } from '@/lib/today';

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

function numberOrNull(value: unknown): number | null {
  if (value === '' || value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
}

export function StockPage() {
  const { farmId = '' } = useParams();
  const { t } = useTranslation();
  const farms = useQuery({ queryKey: ['farms'], queryFn: () => api<FarmSummary[]>('/api/v1/farms') });
  const access = farms.data?.find((farm) => farm.id === farmId);
  const items = useQuery({ queryKey: ['stock-items', farmId], queryFn: () => api<StockItem[]>(`/api/v1/farms/${farmId}/stock-items`) });
  const movements = useQuery({
    queryKey: ['stock-movements', farmId],
    queryFn: () => api<StockMovement[]>(`/api/v1/farms/${farmId}/stock-movements`),
  });
  const water = useQuery({ queryKey: ['water', farmId], queryFn: () => api<WaterRecord[]>(`/api/v1/farms/${farmId}/water`) });
  const targets = useQuery({
    queryKey: ['growth-targets', farmId],
    queryFn: () => api<GrowthTarget[]>(`/api/v1/farms/${farmId}/growth-targets`),
  });
  const weighings = useQuery({ queryKey: ['weighings', farmId], queryFn: () => api<Weighing[]>(`/api/v1/farms/${farmId}/weighings`) });
  const canManage = Boolean(access?.permissions.includes('stock.manage'));
  const canRecord = Boolean(access?.permissions.includes('stock.record'));

  if (items.isLoading || movements.isLoading || water.isLoading || targets.isLoading || weighings.isLoading || farms.isLoading) return <p>{t('common.loading')}</p>;
  if (items.isError || !items.data) return <Alert>{explain(items.error, t)}</Alert>;
  if (movements.isError || !movements.data) return <Alert>{explain(movements.error, t)}</Alert>;
  if (water.isError || !water.data) return <Alert>{explain(water.error, t)}</Alert>;
  if (targets.isError || !targets.data) return <Alert>{explain(targets.error, t)}</Alert>;
  if (weighings.isError || !weighings.data) return <Alert>{explain(weighings.error, t)}</Alert>;

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold">{t('stock.title')}</h1>
          <p className="mt-1 text-ink-soft">{t('stock.body')}</p>
        </div>
        {canManage ? <JumpAdd add="stock" target="create-stock">{t('stock.addItem')}</JumpAdd> : null}
      </div>
      <p className="rounded-xl bg-gold/30 px-3 py-2 text-sm">{t('stock.noValue')}</p>
      <section className="grid gap-3">
        <h2 className="font-display text-2xl">{t('stock.items')}</h2>
        {items.data.length === 0 ? <p className="text-ink-soft">{t('stock.noItems')}</p> : null}
        {items.data.map((item) => (
          <Card key={item.id}>
            <h3 className="font-display text-xl">{item.name}</h3>
            <p className="text-sm text-ink-soft">
              {t('stock.onHand')}: {item.onHand} {item.unitLabel}
              {item.reorderLevel === null ? '' : ` · ${t('stock.reorder')}: ${item.reorderLevel}`}
              {item.belowReorder ? ` · ${t('stock.below')}` : ''}
            </p>
          </Card>
        ))}
        {canManage ? <ItemForm farmId={farmId} /> : null}
      </section>
      <section className="grid gap-3">
        <h2 className="font-display text-2xl">{t('stock.movements')}</h2>
        {movements.data.length === 0 ? <p className="text-ink-soft">{t('stock.noMovements')}</p> : null}
        {movements.data.map((movement) => (
          <Card key={movement.id}>
            <p className="font-semibold">
              {movement.occurredOn} · {t(`stock.type.${movement.movementType}`)} · {t(`stock.direction.${movement.direction}`)} {movement.quantity}{' '}
              {movement.unitLabel}
            </p>
            <p className="text-sm text-ink-soft">
              {movement.itemName}
              {movement.unitCost === null ? ` · ${t('stock.noAmount')}` : ` · ${t('stock.amountTyped')}: ${movement.unitCost}`}
              {movement.reason ? ` · ${movement.reason}` : ''}
            </p>
          </Card>
        ))}
        {canRecord ? <MovementForm farmId={farmId} items={items.data} /> : null}
      </section>
      <section className="grid gap-3">
        <h2 className="font-display text-2xl">{t('stock.water')}</h2>
        <p className="text-sm text-ink-soft">{t('stock.waterNote')}</p>
        {water.data.length === 0 ? <p className="text-ink-soft">{t('stock.noWater')}</p> : null}
        {water.data.map((record) => (
          <Card key={record.id}>
            <p className="font-semibold">
              {record.recordedOn}
              {record.quantity === null ? '' : ` · ${record.quantity} ${record.unitLabel ?? ''}`}
            </p>
            <p className="text-sm text-ink-soft">{record.laboratoryResult ? record.testNote : t('stock.notLab')}</p>
            {record.notes ? <p>{record.notes}</p> : null}
          </Card>
        ))}
        {canRecord ? <WaterForm farmId={farmId} /> : null}
      </section>
      <section className="grid gap-3">
        <h2 className="font-display text-2xl">{t('stock.growth')}</h2>
        <p className="rounded-xl bg-gold/30 px-3 py-2 text-sm">{t('stock.noStandard')}</p>
        {targets.data.length === 0 ? <p className="text-ink-soft">{t('stock.noTargets')}</p> : null}
        {targets.data.map((target) => (
          <Card key={target.id}>
            <p>
              {target.birdTypeName} · {t('stock.ageDays', { count: target.ageDays })} · {target.targetWeight} {target.weightUnit}
            </p>
          </Card>
        ))}
        {canManage ? <TargetForm farmId={farmId} /> : null}
        {weighings.data.map((weighing) => (
          <Card key={weighing.id}>
            <p className="font-semibold">
              {weighing.batchCode} · {weighing.weighedOn} · {weighing.weightValue} {weighing.weightUnit}
            </p>
            <p className="text-sm text-ink-soft">
              {weighing.ageDays === null ? t('stock.ageNotEntered') : t('stock.ageDays', { count: weighing.ageDays })}
              {weighing.ownerTarget
                ? ` · ${t('stock.yourTarget')}: ${weighing.ownerTarget.targetWeight} ${weighing.ownerTarget.weightUnit}`
                : ` · ${t('stock.noMatchingTarget')}`}
            </p>
          </Card>
        ))}
        {canRecord ? <WeighingForm farmId={farmId} /> : null}
      </section>
    </div>
  );
}

function ItemForm({ farmId }: { farmId: string }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const form = useForm<z.infer<typeof stockItemInputSchema>>({
    resolver: zodResolver(stockItemInputSchema),
    defaultValues: { name: '', unitLabel: '', reorderLevel: null, notes: '' },
  });
  const mutation = useMutation({
    mutationFn: (values: z.infer<typeof stockItemInputSchema>) => api(`/api/v1/farms/${farmId}/stock-items`, { method: 'POST', json: values }),
    onSuccess: () => {
      form.reset();
      void queryClient.invalidateQueries({ queryKey: ['stock-items', farmId] });
    },
  });
  return (
    <Card>
      <div id="create-stock" />
      <form
        className="grid gap-3"
        onSubmit={form.handleSubmit((values) => mutation.mutate({ ...values, reorderLevel: numberOrNull(form.getValues('reorderLevel')) }))}
      >
        <h3 className="font-display text-xl">{t('stock.addItem')}</h3>
        <Field id="item-name" label={t('stock.itemName')} error={text(t, form.formState.errors.name?.message)} hint={t('fieldHint.item-name')}>
          <Input id="item-name" {...form.register('name')}  placeholder={t('fieldPh.item-name')}/>
        </Field>
        <Field id="item-unit" label={t('stock.unit')} hint={t('stock.unitHint')} error={text(t, form.formState.errors.unitLabel?.message)}>
          <Input id="item-unit" {...form.register('unitLabel')}  placeholder={t('fieldPh.item-unit')}/>
        </Field>
        <Field id="item-reorder" label={`${t('stock.reorder')} (${t('common.optional')})`} error={text(t, form.formState.errors.reorderLevel?.message)} hint={t('fieldHint.item-reorder')}>
          <Input id="item-reorder" type="number" min={0} step="0.001" {...form.register('reorderLevel', { setValueAs: numberOrNull })}  placeholder={t('fieldPh.item-reorder')}/>
        </Field>
        <Field id="item-notes" label={`${t('stock.notes')} (${t('common.optional')})`} hint={t('fieldHint.item-notes')}>
          <TextArea id="item-notes" {...form.register('notes')}  placeholder={t('fieldPh.item-notes')}/>
        </Field>
        {mutation.isError ? <Alert>{explain(mutation.error, t)}</Alert> : null}
        <Button type="submit">{mutation.isPending ? t('stock.saving') : t('stock.saveItem')}</Button>
      </form>
    </Card>
  );
}

function MovementForm({ farmId, items }: { farmId: string; items: StockItem[] }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const batches = useQuery({ queryKey: ['batches', farmId], queryFn: () => api<Batch[]>(`/api/v1/farms/${farmId}/batches`) });
  const sheds = useQuery({ queryKey: ['sheds', farmId], queryFn: () => api<Shed[]>(`/api/v1/farms/${farmId}/sheds`) });
  const form = useForm<z.infer<typeof stockMovementInputSchema>>({
    resolver: zodResolver(stockMovementInputSchema),
    defaultValues: {
      itemId: '',
      movementType: 'receipt',
      direction: 'in',
      quantity: 0,
      occurredOn: localToday(),
      batchId: '',
      shedId: '',
      lotCode: '',
      expiresOn: '',
      unitCost: null,
      supplierName: '',
      reason: '',
    },
  });
  const movementType = form.watch('movementType');
  const mutation = useMutation({
    mutationFn: (values: z.infer<typeof stockMovementInputSchema>) =>
      api(`/api/v1/farms/${farmId}/stock-movements`, { method: 'POST', json: values }),
    onSuccess: () => {
      form.reset();
      void queryClient.invalidateQueries({ queryKey: ['stock-movements', farmId] });
      void queryClient.invalidateQueries({ queryKey: ['stock-items', farmId] });
    },
  });
  return (
    <Card>
      <form
        className="grid gap-3"
        onSubmit={form.handleSubmit((values) => {
          const direction = values.movementType === 'reversal' ? values.direction : values.movementType === 'receipt' ? 'in' : 'out';
          mutation.mutate({
            ...values,
            direction,
            quantity: Number(values.quantity),
            unitCost: values.movementType === 'receipt' ? numberOrNull(values.unitCost) : null,
          });
        })}
      >
        <h3 className="font-display text-xl">{t('stock.addMovement')}</h3>
        <Field id="move-item" label={t('stock.itemName')} error={text(t, form.formState.errors.itemId?.message)} hint={t('fieldHint.move-item')}>
          <select id="move-item" className={selectClass} {...form.register('itemId')}>
            <option value="">{t('stock.choose')}</option>
            {items.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </Field>
        <Field id="stock-move-type" label={t('stock.movementType')} hint={t('fieldHint.stock-move-type')}>
          <select id="stock-move-type" className={selectClass} {...form.register('movementType')}>
            {(['receipt', 'use', 'wastage', 'reversal'] as const).map((type) => (
              <option key={type} value={type}>
                {t(`stock.type.${type}`)}
              </option>
            ))}
          </select>
        </Field>
        {movementType === 'reversal' ? (
          <Field id="move-direction" label={t('stock.directionLabel')} hint={t('fieldHint.move-direction')}>
            <select id="move-direction" className={selectClass} {...form.register('direction')}>
              <option value="in">{t('stock.direction.in')}</option>
              <option value="out">{t('stock.direction.out')}</option>
            </select>
          </Field>
        ) : null}
        <Field id="move-qty" label={t('stock.quantity')} error={text(t, form.formState.errors.quantity?.message)} hint={t('fieldHint.move-qty')}>
          <Input id="move-qty" type="number" min={0} step="0.001" {...form.register('quantity', { valueAsNumber: true })}  placeholder={t('fieldPh.move-qty')}/>
        </Field>
        <Field id="stock-move-date" label={t('stock.date')} error={text(t, form.formState.errors.occurredOn?.message)} hint={t('fieldHint.stock-move-date')}>
          <Input id="stock-move-date" type="date" {...form.register('occurredOn')} />
        </Field>
        <Field id="move-batch" label={`${t('stock.batch')} (${t('common.optional')})`} hint={t('fieldHint.move-batch')}>
          <select id="move-batch" className={selectClass} {...form.register('batchId')}>
            <option value="">{t('stock.none')}</option>
            {(batches.data ?? []).map((batch) => (
              <option key={batch.id} value={batch.id}>
                {batch.code}
              </option>
            ))}
          </select>
        </Field>
        <Field id="move-shed" label={`${t('stock.shed')} (${t('common.optional')})`} hint={t('fieldHint.move-shed')}>
          <select id="move-shed" className={selectClass} {...form.register('shedId')}>
            <option value="">{t('stock.none')}</option>
            {(sheds.data ?? []).map((shed) => (
              <option key={shed.id} value={shed.id}>
                {shed.code}
              </option>
            ))}
          </select>
        </Field>
        {movementType === 'receipt' ? (
          <Field id="move-cost" label={`${t('stock.amountTyped')} (${t('common.optional')})`} hint={t('stock.amountHint')} error={text(t, form.formState.errors.unitCost?.message)}>
            <Input id="move-cost" type="number" min={0} step="0.01" {...form.register('unitCost', { setValueAs: numberOrNull })} />
          </Field>
        ) : null}
        <Field id="stock-move-reason" label={movementType === 'reversal' ? t('stock.reason') : `${t('stock.reason')} (${t('common.optional')})`} error={text(t, form.formState.errors.reason?.message)} hint={t('fieldHint.stock-move-reason')}>
          <Input id="stock-move-reason" {...form.register('reason')}  placeholder={t('fieldPh.stock-move-reason')}/>
        </Field>
        {mutation.isError ? <Alert>{explain(mutation.error, t)}</Alert> : null}
        <Button type="submit">{mutation.isPending ? t('stock.saving') : t('stock.saveMovement')}</Button>
      </form>
    </Card>
  );
}

function WaterForm({ farmId }: { farmId: string }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const form = useForm<z.infer<typeof waterInputSchema>>({
    resolver: zodResolver(waterInputSchema),
    defaultValues: { recordedOn: localToday(), batchId: '', shedId: '', quantity: null, unitLabel: '', sourceNote: '', testNote: '', notes: '' },
  });
  const mutation = useMutation({
    mutationFn: (values: z.infer<typeof waterInputSchema>) => api(`/api/v1/farms/${farmId}/water`, { method: 'POST', json: values }),
    onSuccess: () => {
      form.reset();
      void queryClient.invalidateQueries({ queryKey: ['water', farmId] });
    },
  });
  return (
    <Card>
      <form
        className="grid gap-3"
        onSubmit={form.handleSubmit((values) => mutation.mutate({ ...values, quantity: numberOrNull(values.quantity) }))}
      >
        <h3 className="font-display text-xl">{t('stock.addWater')}</h3>
        <Field id="water-date" label={t('stock.date')} error={text(t, form.formState.errors.recordedOn?.message)} hint={t('fieldHint.water-date')}>
          <Input id="water-date" type="date" {...form.register('recordedOn')} />
        </Field>
        <Field id="water-qty" label={`${t('stock.quantity')} (${t('common.optional')})`} error={text(t, form.formState.errors.quantity?.message)} hint={t('fieldHint.water-qty')}>
          <Input id="water-qty" type="number" min={0} step="0.001" {...form.register('quantity', { setValueAs: numberOrNull })}  placeholder={t('fieldPh.water-qty')}/>
        </Field>
        <Field id="water-unit" label={t('stock.unit')} error={text(t, form.formState.errors.unitLabel?.message)} hint={t('fieldHint.water-unit')}>
          <Input id="water-unit" {...form.register('unitLabel')}  placeholder={t('fieldPh.water-unit')}/>
        </Field>
        <Field id="water-source" label={`${t('stock.source')} (${t('common.optional')})`} hint={t('fieldHint.water-source')}>
          <Input id="water-source" {...form.register('sourceNote')}  placeholder={t('fieldPh.water-source')}/>
        </Field>
        <Field id="water-test" label={`${t('stock.testNote')} (${t('common.optional')})`} hint={t('stock.testHint')}>
          <TextArea id="water-test" {...form.register('testNote')}  placeholder={t('fieldPh.water-test')}/>
        </Field>
        <Field id="water-notes" label={`${t('stock.notes')} (${t('common.optional')})`} hint={t('fieldHint.water-notes')}>
          <TextArea id="water-notes" {...form.register('notes')}  placeholder={t('fieldPh.water-notes')}/>
        </Field>
        {mutation.isError ? <Alert>{explain(mutation.error, t)}</Alert> : null}
        <Button type="submit">{mutation.isPending ? t('stock.saving') : t('stock.saveWater')}</Button>
      </form>
    </Card>
  );
}

function TargetForm({ farmId }: { farmId: string }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const types = useQuery({ queryKey: ['bird-types', farmId], queryFn: () => api<BirdType[]>(`/api/v1/farms/${farmId}/bird-types`) });
  const form = useForm<z.infer<typeof growthTargetInputSchema>>({
    resolver: zodResolver(growthTargetInputSchema),
    defaultValues: { birdTypeId: '', ageDays: 0, targetWeight: 0, weightUnit: 'g' },
  });
  const mutation = useMutation({
    mutationFn: (values: z.infer<typeof growthTargetInputSchema>) =>
      api(`/api/v1/farms/${farmId}/growth-targets`, { method: 'POST', json: values }),
    onSuccess: () => {
      form.reset({ birdTypeId: '', ageDays: 0, targetWeight: 0, weightUnit: 'g' });
      void queryClient.invalidateQueries({ queryKey: ['growth-targets', farmId] });
    },
  });
  return (
    <Card>
      <form className="grid gap-3" onSubmit={form.handleSubmit((values) => mutation.mutate(values))}>
        <h3 className="font-display text-xl">{t('stock.addTarget')}</h3>
        <Field id="target-type" label={t('stock.birdType')} error={text(t, form.formState.errors.birdTypeId?.message)} hint={t('fieldHint.target-type')}>
          <select id="target-type" className={selectClass} {...form.register('birdTypeId')}>
            <option value="">{t('stock.choose')}</option>
            {(types.data ?? []).filter((item) => item.status === 'active').map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </Field>
        <Field id="target-age" label={t('stock.ageYouType')} hint={t('stock.ageHint')} error={text(t, form.formState.errors.ageDays?.message)}>
          <Input id="target-age" type="number" min={1} {...form.register('ageDays', { valueAsNumber: true })} />
        </Field>
        <Field id="target-weight" label={t('stock.targetWeight')} error={text(t, form.formState.errors.targetWeight?.message)} hint={t('fieldHint.target-weight')}>
          <Input id="target-weight" type="number" min={0} step="0.001" {...form.register('targetWeight', { valueAsNumber: true })}  placeholder={t('fieldPh.target-weight')}/>
        </Field>
        <Field id="target-unit" label={t('stock.weightUnit')} hint={t('fieldHint.target-unit')}>
          <select id="target-unit" className={selectClass} {...form.register('weightUnit')}>
            <option value="g">g</option>
            <option value="kg">kg</option>
          </select>
        </Field>
        {mutation.isError ? <Alert>{explain(mutation.error, t)}</Alert> : null}
        <Button type="submit">{mutation.isPending ? t('stock.saving') : t('stock.saveTarget')}</Button>
      </form>
    </Card>
  );
}

function WeighingForm({ farmId }: { farmId: string }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const batches = useQuery({ queryKey: ['batches', farmId], queryFn: () => api<Batch[]>(`/api/v1/farms/${farmId}/batches`) });
  const [open, setOpen] = useState(false);
  const form = useForm<z.infer<typeof weighingInputSchema>>({
    resolver: zodResolver(weighingInputSchema),
    defaultValues: { batchId: '', weighedOn: localToday(), ageDays: null, weightValue: 0, weightUnit: 'g', birdCount: null, notes: '' },
  });
  const mutation = useMutation({
    mutationFn: (values: z.infer<typeof weighingInputSchema>) => api(`/api/v1/farms/${farmId}/weighings`, { method: 'POST', json: values }),
    onSuccess: () => {
      form.reset();
      setOpen(false);
      void queryClient.invalidateQueries({ queryKey: ['weighings', farmId] });
    },
  });
  if (!open) {
    return (
      <Button type="button" variant="outline" onClick={() => setOpen(true)}>
        {t('stock.addWeighing')}
      </Button>
    );
  }
  return (
    <Card>
      <form
        className="grid gap-3"
        onSubmit={form.handleSubmit((values) =>
          mutation.mutate({ ...values, ageDays: numberOrNull(values.ageDays), birdCount: numberOrNull(values.birdCount), weightValue: Number(values.weightValue) }),
        )}
      >
        <h3 className="font-display text-xl">{t('stock.addWeighing')}</h3>
        <Field id="weigh-batch" label={t('stock.batch')} error={text(t, form.formState.errors.batchId?.message)} hint={t('fieldHint.weigh-batch')}>
          <select id="weigh-batch" className={selectClass} {...form.register('batchId')}>
            <option value="">{t('stock.choose')}</option>
            {(batches.data ?? []).map((batch) => (
              <option key={batch.id} value={batch.id}>
                {batch.code}
              </option>
            ))}
          </select>
        </Field>
        <Field id="weigh-date" label={t('stock.date')} error={text(t, form.formState.errors.weighedOn?.message)} hint={t('fieldHint.weigh-date')}>
          <Input id="weigh-date" type="date" {...form.register('weighedOn')} />
        </Field>
        <Field id="weigh-age" label={`${t('stock.ageYouType')} (${t('common.optional')})`} hint={t('stock.ageHint')} error={text(t, form.formState.errors.ageDays?.message)}>
          <Input id="weigh-age" type="number" min={1} {...form.register('ageDays', { setValueAs: numberOrNull })} />
        </Field>
        <Field id="weigh-value" label={t('stock.weight')} error={text(t, form.formState.errors.weightValue?.message)} hint={t('fieldHint.weigh-value')}>
          <Input id="weigh-value" type="number" min={0} step="0.001" {...form.register('weightValue', { valueAsNumber: true })}  placeholder={t('fieldPh.weigh-value')}/>
        </Field>
        <Field id="weigh-unit" label={t('stock.weightUnit')} hint={t('fieldHint.weigh-unit')}>
          <select id="weigh-unit" className={selectClass} {...form.register('weightUnit')}>
            <option value="g">g</option>
            <option value="kg">kg</option>
          </select>
        </Field>
        {mutation.isError ? <Alert>{explain(mutation.error, t)}</Alert> : null}
        <Button type="submit">{mutation.isPending ? t('stock.saving') : t('stock.saveWeighing')}</Button>
      </form>
    </Card>
  );
}
