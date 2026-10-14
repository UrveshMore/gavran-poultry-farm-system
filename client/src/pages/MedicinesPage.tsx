import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { Alert, Button, Card, Field, Input, TextArea } from '@/components/ui';
import { ApiError, api, errorKey } from '@/lib/api';
import { withServer } from '@/lib/serverAddress';

type DiseaseChoice = { id: string; name: string; symptoms: string };
type Medicine = {
  id: string;
  name: string;
  doseAmount: string;
  doseUnit: string;
  forBirds: number | null;
  route: string;
  slot: string;
  ageDayFrom: number | null;
  ageDayTo: number | null;
  durationDays: number;
  notes: string;
  precaution: string;
  sourceKind: string;
  sourceDetail: string;
  photoKey: string | null;
  cite: string;
  diseases: Array<{ knowledgeEntryId: string | null; ownerDiseaseId: string | null; name: string }>;
  plans: Array<{ id: string; batchCode: string; anchor: string; startOn: string | null; startAgeDay: number | null; repeatDays: number }>;
};

const blank = {
  name: '',
  doseAmount: '',
  doseUnit: '',
  forBirds: '',
  route: 'water',
  slot: 'morning',
  ageDayFrom: '',
  ageDayTo: '',
  durationDays: '3',
  notes: '',
  precaution: '',
  sourceKind: 'experience',
  sourceDetail: '',
  knowledgeEntryIds: [] as string[],
  ownerDiseaseIds: [] as string[],
  newDisease: '',
  symptoms: '',
};

function explain(error: unknown, t: (key: string) => string) {
  if (error instanceof ApiError) {
    if (error.status === 403) return t('common.permissionDenied');
    const key = errorKey(error);
    return key ? t(key) : t('common.errorGeneric');
  }
  return t('common.errorGeneric');
}

function num(value: string): number | null {
  if (value.trim() === '') return null;
  return Number(value);
}

export function MedicinesPage() {
  const { farmId = '' } = useParams();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [form, setForm] = useState(blank);
  const [editing, setEditing] = useState<string | null>(null);
  const [photo, setPhoto] = useState<File | null>(null);
  const [diseasePhoto, setDiseasePhoto] = useState<File | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [plan, setPlan] = useState({ batchId: '', anchor: 'date', startOn: '', startAgeDay: '', repeatDays: '1' });
  const list = useQuery({ queryKey: ['owner-medicines', farmId], queryFn: () => api<Medicine[]>(`/api/v1/farms/${farmId}/owner-medicines`) });
  const choices = useQuery({
    queryKey: ['owner-medicine-choices', farmId],
    queryFn: () => api<{ paperDiseases: DiseaseChoice[]; ownerDiseases: DiseaseChoice[]; batches: Array<{ id: string; code: string; hatchDate: string | null }> }>(`/api/v1/farms/${farmId}/owner-medicines/choices`),
  });

  function set<K extends keyof typeof blank>(key: K, value: (typeof blank)[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  const save = useMutation({
    mutationFn: async () => {
      let ownerDiseaseIds = form.ownerDiseaseIds;
      if (form.newDisease.trim()) {
        const created = await api<{ id: string }>(`/api/v1/farms/${farmId}/owner-diseases`, {
          method: 'POST',
          json: { name: form.newDisease.trim(), symptoms: form.symptoms.trim() },
        });
        ownerDiseaseIds = [...ownerDiseaseIds, created.id];
        if (diseasePhoto) {
          const body = new FormData();
          body.set('file', diseasePhoto);
          await api(`/api/v1/farms/${farmId}/owner-diseases/${created.id}/photos`, { method: 'POST', form: body });
        }
      }
      const payload = {
        name: form.name.trim(),
        doseAmount: form.doseAmount.trim(),
        doseUnit: form.doseUnit.trim(),
        forBirds: num(form.forBirds),
        route: form.route,
        slot: form.slot,
        ageDayFrom: num(form.ageDayFrom),
        ageDayTo: num(form.ageDayTo),
        durationDays: Number(form.durationDays),
        notes: form.notes.trim(),
        precaution: form.precaution.trim(),
        sourceKind: form.sourceKind,
        sourceDetail: form.sourceDetail.trim(),
        knowledgeEntryIds: form.knowledgeEntryIds,
        ownerDiseaseIds,
      };
      const saved = editing
        ? await api<Medicine>(`/api/v1/farms/${farmId}/owner-medicines/${editing}`, { method: 'PATCH', json: payload })
        : await api<Medicine>(`/api/v1/farms/${farmId}/owner-medicines`, { method: 'POST', json: payload });
      if (photo) {
        const body = new FormData();
        body.set('file', photo);
        await api(`/api/v1/farms/${farmId}/owner-medicines/${saved.id}/photo`, { method: 'POST', form: body });
      }
      return saved;
    },
    onSuccess: async () => {
      setForm(blank);
      setEditing(null);
      setPhoto(null);
      setDiseasePhoto(null);
      await queryClient.invalidateQueries({ queryKey: ['owner-medicines', farmId] });
      await queryClient.invalidateQueries({ queryKey: ['owner-medicine-choices', farmId] });
      await queryClient.invalidateQueries({ queryKey: ['dashboard', farmId] });
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => api(`/api/v1/farms/${farmId}/owner-medicines/${id}`, { method: 'DELETE' }),
    onSuccess: async () => {
      setConfirmId(null);
      await queryClient.invalidateQueries({ queryKey: ['owner-medicines', farmId] });
      await queryClient.invalidateQueries({ queryKey: ['dashboard', farmId] });
    },
  });

  const attach = useMutation({
    mutationFn: (medicineId: string) =>
      api(`/api/v1/farms/${farmId}/owner-medicines/${medicineId}/plans`, {
        method: 'POST',
        json: {
          batchId: plan.batchId,
          anchor: plan.anchor,
          startOn: plan.anchor === 'date' ? plan.startOn : null,
          startAgeDay: plan.anchor === 'age' ? num(plan.startAgeDay) : null,
          repeatDays: Number(plan.repeatDays || '1'),
        },
      }),
    onSuccess: async () => {
      setPlan({ batchId: '', anchor: 'date', startOn: '', startAgeDay: '', repeatDays: '1' });
      await queryClient.invalidateQueries({ queryKey: ['owner-medicines', farmId] });
      await queryClient.invalidateQueries({ queryKey: ['dashboard', farmId] });
      await queryClient.invalidateQueries({ queryKey: ['batch-doses'] });
    },
  });

  function toggle(key: 'knowledgeEntryIds' | 'ownerDiseaseIds', id: string) {
    setForm((current) => ({
      ...current,
      [key]: current[key].includes(id) ? current[key].filter((item) => item !== id) : [...current[key], id],
    }));
  }

  return (
    <div className="grid gap-4">
      <div>
        <h1 className="font-display text-3xl font-semibold">{t('medicines.title')}</h1>
        <p className="mt-1 text-ink-soft">{t('medicines.body')}</p>
      </div>
      {list.isLoading ? <p>{t('common.loading')}</p> : null}
      {list.isError ? <Alert>{explain(list.error, t)}</Alert> : null}
      {list.data && list.data.length === 0 ? <Card><p className="text-ink-soft">{t('medicines.empty')}</p></Card> : null}
      {list.data?.map((item) => (
        <Card key={item.id}>
          <p className="text-xs font-semibold uppercase tracking-wide text-grove">{t('medicines.addedByOwner')}</p>
          <h2 className="font-display text-2xl">{item.name}</h2>
          <p className="text-sm">{item.doseAmount} {item.doseUnit} · {t(`medicines.route.${item.route}`)} · {t(`doses.slot.${item.slot}`)}</p>
          <p className="text-sm text-ink-soft">{item.diseases.map((disease) => disease.name).join(', ')}</p>
          {item.photoKey ? <img src={withServer(`/api/v1/farms/${farmId}/medicine-photos/${item.photoKey}`)} alt="" className="mt-2 h-16 w-16 object-contain" /> : null}
          {item.plans.length > 0 ? (
            <ul className="mt-2 text-sm">
              {item.plans.map((row) => (
                <li key={row.id}>{t('medicines.onFlock', { code: row.batchCode, when: row.anchor === 'date' ? row.startOn ?? '' : String(row.startAgeDay ?? ''), every: String(row.repeatDays) })}</li>
              ))}
            </ul>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setEditing(item.id);
                setForm({
                  ...blank,
                  name: item.name,
                  doseAmount: item.doseAmount,
                  doseUnit: item.doseUnit,
                  forBirds: item.forBirds === null ? '' : String(item.forBirds),
                  route: item.route,
                  slot: item.slot,
                  ageDayFrom: item.ageDayFrom === null ? '' : String(item.ageDayFrom),
                  ageDayTo: item.ageDayTo === null ? '' : String(item.ageDayTo),
                  durationDays: String(item.durationDays),
                  notes: item.notes,
                  precaution: item.precaution,
                  sourceKind: item.sourceKind,
                  sourceDetail: item.sourceDetail,
                  knowledgeEntryIds: item.diseases.map((disease) => disease.knowledgeEntryId).filter((id): id is string => Boolean(id)),
                  ownerDiseaseIds: item.diseases.map((disease) => disease.ownerDiseaseId).filter((id): id is string => Boolean(id)),
                });
              }}
            >
              {t('medicines.edit')}
            </Button>
            <Button type="button" variant="outline" onClick={() => (confirmId === item.id ? remove.mutate(item.id) : setConfirmId(item.id))}>
              {confirmId === item.id ? t('medicines.removeConfirm') : t('medicines.remove')}
            </Button>
          </div>
          <form
            className="mt-3 grid gap-3 border-t border-line pt-3"
            onSubmit={(event) => {
              event.preventDefault();
              attach.mutate(item.id);
            }}
          >
            <h3 className="font-semibold">{t('medicines.attach')}</h3>
            <Field id={`batch-${item.id}`} label={t('medicines.batch')}>
              <select id={`batch-${item.id}`} className="min-h-11 w-full rounded-xl border border-line bg-white px-3" value={plan.batchId} onChange={(event) => setPlan({ ...plan, batchId: event.target.value })}>
                <option value="">{t('saathi.pick')}</option>
                {choices.data?.batches.map((batch) => (
                  <option key={batch.id} value={batch.id}>{batch.code}</option>
                ))}
              </select>
            </Field>
            <div className="flex flex-wrap gap-3 text-sm">
              <label className="flex min-h-11 items-center gap-2"><input type="radio" name={`anchor-${item.id}`} checked={plan.anchor === 'date'} onChange={() => setPlan({ ...plan, anchor: 'date' })} />{t('medicines.anchorDate')}</label>
              <label className="flex min-h-11 items-center gap-2"><input type="radio" name={`anchor-${item.id}`} checked={plan.anchor === 'age'} onChange={() => setPlan({ ...plan, anchor: 'age' })} />{t('medicines.anchorAge')}</label>
            </div>
            {plan.anchor === 'date' ? (
              <Field id={`start-${item.id}`} label={t('medicines.startOn')}>
                <Input id={`start-${item.id}`} type="date" value={plan.startOn} onChange={(event) => setPlan({ ...plan, startOn: event.target.value })} />
              </Field>
            ) : (
              <Field id={`age-${item.id}`} label={t('medicines.startAge')} hint={t('medicines.whenHint')}>
                <Input id={`age-${item.id}`} inputMode="numeric" value={plan.startAgeDay} onChange={(event) => setPlan({ ...plan, startAgeDay: event.target.value })} />
              </Field>
            )}
            <Field id={`repeat-${item.id}`} label={t('medicines.repeat')} hint={t('medicines.repeatHint')}>
              <Input id={`repeat-${item.id}`} inputMode="numeric" value={plan.repeatDays} onChange={(event) => setPlan({ ...plan, repeatDays: event.target.value })} />
            </Field>
            {attach.isError ? <Alert>{explain(attach.error, t)}</Alert> : null}
            <Button type="submit" disabled={attach.isPending || !plan.batchId}>{t('medicines.attachSave')}</Button>
          </form>
        </Card>
      ))}
      <Card>
        <h2 className="font-display text-2xl">{editing ? t('medicines.edit') : t('medicines.add')}</h2>
        <form
          className="mt-3 grid gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            save.mutate();
          }}
        >
          <Field id="med-name" label={t('medicines.name')} hint={t('medicines.nameHint')}>
            <Input id="med-name" value={form.name} onChange={(event) => set('name', event.target.value)} />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field id="med-amount" label={t('medicines.amount')} hint={t('medicines.amountHint')}>
              <Input id="med-amount" value={form.doseAmount} onChange={(event) => set('doseAmount', event.target.value)} />
            </Field>
            <Field id="med-unit" label={t('medicines.unit')} hint={t('medicines.unitHint')}>
              <Input id="med-unit" value={form.doseUnit} onChange={(event) => set('doseUnit', event.target.value)} />
            </Field>
          </div>
          <Field id="med-birds" label={t('medicines.forBirds')} hint={t('medicines.forBirdsHint')}>
            <Input id="med-birds" inputMode="numeric" value={form.forBirds} onChange={(event) => set('forBirds', event.target.value)} />
          </Field>
          <Field id="med-route" label={t('medicines.route')}>
            <select id="med-route" className="min-h-11 w-full rounded-xl border border-line bg-white px-3" value={form.route} onChange={(event) => set('route', event.target.value)}>
              {(['water', 'feed', 'eye_drop', 'injection'] as const).map((route) => (
                <option key={route} value={route}>{t(`medicines.route.${route}`)}</option>
              ))}
            </select>
          </Field>
          <Field id="med-slot" label={t('medicines.slot')}>
            <select id="med-slot" className="min-h-11 w-full rounded-xl border border-line bg-white px-3" value={form.slot} onChange={(event) => set('slot', event.target.value)}>
              {(['morning', 'evening', 'full_day'] as const).map((slot) => (
                <option key={slot} value={slot}>{t(`doses.slot.${slot}`)}</option>
              ))}
            </select>
          </Field>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field id="med-from" label={t('medicines.dayFrom')} hint={t('medicines.whenHint')}>
              <Input id="med-from" inputMode="numeric" value={form.ageDayFrom} onChange={(event) => set('ageDayFrom', event.target.value)} />
            </Field>
            <Field id="med-to" label={t('medicines.dayTo')}>
              <Input id="med-to" inputMode="numeric" value={form.ageDayTo} onChange={(event) => set('ageDayTo', event.target.value)} />
            </Field>
            <Field id="med-days" label={t('medicines.duration')} hint={t('medicines.durationHint')}>
              <Input id="med-days" inputMode="numeric" value={form.durationDays} onChange={(event) => set('durationDays', event.target.value)} />
            </Field>
          </div>
          <Field id="med-why" label={t('medicines.notes')} hint={t('medicines.notesHint')}>
            <TextArea id="med-why" value={form.notes} onChange={(event) => set('notes', event.target.value)} />
          </Field>
          <Field id="med-watch" label={t('medicines.precaution')} hint={t('medicines.precautionHint')}>
            <TextArea id="med-watch" value={form.precaution} onChange={(event) => set('precaution', event.target.value)} />
          </Field>
          <Field id="med-source" label={t('medicines.source')}>
            <select id="med-source" className="min-h-11 w-full rounded-xl border border-line bg-white px-3" value={form.sourceKind} onChange={(event) => set('sourceKind', event.target.value)}>
              {(['experience', 'vet', 'paper'] as const).map((kind) => (
                <option key={kind} value={kind}>{t(`medicines.source.${kind}`)}</option>
              ))}
            </select>
          </Field>
          {form.sourceKind === 'experience' ? null : (
            <Field id="med-source-name" label={t('medicines.sourceDetail')} hint={t('medicines.sourceDetailHint')}>
              <Input id="med-source-name" value={form.sourceDetail} onChange={(event) => set('sourceDetail', event.target.value)} />
            </Field>
          )}
          <fieldset className="grid max-h-48 gap-1 overflow-auto rounded-xl border border-line p-3">
            <legend className="px-1 text-sm font-semibold">{t('medicines.diseases')}</legend>
            <p className="text-sm text-ink-soft">{t('medicines.diseasesHint')}</p>
            {choices.data?.paperDiseases.map((disease) => (
              <label key={disease.id} className="flex min-h-11 items-center gap-2 text-sm">
                <input type="checkbox" checked={form.knowledgeEntryIds.includes(disease.id)} onChange={() => toggle('knowledgeEntryIds', disease.id)} />
                {disease.name}
              </label>
            ))}
            {choices.data?.ownerDiseases.map((disease) => (
              <label key={disease.id} className="flex min-h-11 items-center gap-2 text-sm">
                <input type="checkbox" checked={form.ownerDiseaseIds.includes(disease.id)} onChange={() => toggle('ownerDiseaseIds', disease.id)} />
                {disease.name} · {t('medicines.addedByOwner')}
              </label>
            ))}
          </fieldset>
          <Field id="med-new-disease" label={t('medicines.newDisease')} hint={t('medicines.newDiseaseHint')}>
            <Input id="med-new-disease" value={form.newDisease} onChange={(event) => set('newDisease', event.target.value)} />
          </Field>
          <Field id="med-symptoms" label={t('medicines.symptoms')} hint={t('medicines.symptomsHint')}>
            <TextArea id="med-symptoms" value={form.symptoms} onChange={(event) => set('symptoms', event.target.value)} />
          </Field>
          <Field id="med-photo" label={t('medicines.photo')} hint={t('medicines.photoHint')}>
            <Input id="med-photo" type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => setPhoto(event.target.files?.[0] ?? null)} />
          </Field>
          <Field id="med-disease-photo" label={t('medicines.diseasePhoto')} hint={t('medicines.photoHint')}>
            <Input id="med-disease-photo" type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => setDiseasePhoto(event.target.files?.[0] ?? null)} />
          </Field>
          {save.isError ? <Alert>{explain(save.error, t)}</Alert> : null}
          <Button type="submit" disabled={save.isPending}>{t('medicines.keep')}</Button>
        </form>
      </Card>
    </div>
  );
}
