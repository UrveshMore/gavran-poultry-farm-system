import {
  CAPACITY_UNIT,
  PERMISSIONS,
  SHED_STATUSES,
  SHED_TYPES,
  VOLUME_UNITS,
  WEIGHT_UNITS,
  farmInputSchema,
  inviteSchema,
  shedInputSchema,
} from '@gavran/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { z } from 'zod';
import { Alert, Button, Card, Field, Input, TextArea } from '@/components/ui';
import { ApiError, api, errorKey } from '@/lib/api';
import type { AuditPage, FarmDetail, FarmSummary, Member, Shed } from '@/lib/types';

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

function applyFields(error: unknown, setError: (name: string, err: { message: string }) => void) {
  if (!(error instanceof ApiError) || !error.details?.fields) return;
  for (const [key, code] of Object.entries(error.details.fields)) {
    setError(key, { message: code });
  }
}

export function FarmsPage() {
  const { t } = useTranslation();
  const farms = useQuery({ queryKey: ['farms'], queryFn: () => api<FarmSummary[]>('/api/v1/farms') });
  const canCreate = !farms.data || farms.data.length === 0 || farms.data.some((farm) => farm.role === 'owner');

  if (farms.isLoading) return <p>{t('common.loading')}</p>;
  if (farms.isError || !farms.data) {
    return (
      <Alert>
        {explain(farms.error, t)}{' '}
        <button type="button" className="underline" onClick={() => void farms.refetch()}>
          {t('common.retry')}
        </button>
      </Alert>
    );
  }

  return (
    <div className="grid gap-4">
      <div>
        <h1 className="font-display text-3xl font-semibold">{t('farms.title')}</h1>
        <p className="mt-1 text-ink-soft">{t('farms.subtitle')}</p>
      </div>
      <p className="rounded-2xl bg-grove px-4 py-3 text-sm text-paper">{t('app.phaseNote')}</p>
      {farms.data.length === 0 ? (
        <Card>
          <h2 className="font-display text-2xl">{t('farms.emptyTitle')}</h2>
          <p className="mt-1 text-ink-soft">{t('farms.emptyBody')}</p>
          {canCreate ? (
            <Button asChild className="mt-4">
              <Link to="/farms/new">{t('farms.create')}</Link>
            </Button>
          ) : (
            <div className="mt-4">
              <h3 className="font-semibold">{t('farms.noAccessTitle')}</h3>
              <p className="text-ink-soft">{t('farms.noAccessBody')}</p>
            </div>
          )}
        </Card>
      ) : (
        <div className="grid gap-3">
          {farms.data.map((farm) => (
            <Card key={farm.id}>
              <p className="text-sm font-semibold uppercase tracking-wide text-ink-soft">{farm.code}</p>
              <h2 className="font-display text-2xl">{farm.name}</h2>
              <p className="text-sm text-ink-soft">
                {t('farms.roleLabel')}: {t(`role.${farm.role}`)}
              </p>
              {farm.permissions.length === 0 ? (
                <p className="mt-2 text-sm">{t('farms.noAccessBody')}</p>
              ) : (
                <Button asChild className="mt-3" variant="outline">
                  <Link to={farm.permissions.includes('farm.read') ? `/farms/${farm.id}` : `/farms/${farm.id}/sheds`}>{t('farms.open')}</Link>
                </Button>
              )}
            </Card>
          ))}
          {canCreate ? (
            <Button asChild variant="clay">
              <Link to="/farms/new">{t('farms.create')}</Link>
            </Button>
          ) : null}
        </div>
      )}
    </div>
  );
}

const emptyFarm = {
  name: '',
  code: '',
  timezone: 'Asia/Kolkata',
  locale: 'en' as const,
  contactName: '',
  contactPhone: '',
  contactEmail: '',
  addressLine: '',
  weightUnit: 'kg' as const,
  volumeUnit: 'L' as const,
};

export function FarmCreatePage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const locale = i18n.language === 'hi' || i18n.language === 'mr' ? i18n.language : 'en';
  const form = useForm<z.infer<typeof farmInputSchema>>({
    resolver: zodResolver(farmInputSchema),
    defaultValues: { ...emptyFarm, locale },
  });
  const mutation = useMutation({
    mutationFn: (values: z.infer<typeof farmInputSchema>) => api<FarmDetail>('/api/v1/farms', { method: 'POST', json: values }),
    onSuccess: (farm) => navigate(`/farms/${farm.id}`),
    onError: (error) => applyFields(error, (name, err) => form.setError(name as 'name', err)),
  });
  return (
    <FarmForm
      title={t('farm.createTitle')}
      body={t('farm.createBody')}
      form={form}
      pending={mutation.isPending}
      error={mutation.isError ? mutation.error : null}
      onSubmit={(values) => mutation.mutate(values)}
    />
  );
}

export function FarmProfilePage() {
  const { farmId = '' } = useParams();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const farm = useQuery({
    queryKey: ['farm', farmId],
    queryFn: () => api<FarmDetail>(`/api/v1/farms/${farmId}`),
    enabled: Boolean(farmId),
  });
  if (farm.isLoading) return <p>{t('common.loading')}</p>;
  if (farm.isError || !farm.data) return <Alert>{explain(farm.error, t)}</Alert>;
  return <ProfileEditor farm={farm.data} onSaved={() => void queryClient.invalidateQueries({ queryKey: ['farm', farmId] })} />;
}

function ProfileEditor({ farm, onSaved }: { farm: FarmDetail; onSaved: () => void }) {
  const { t } = useTranslation();
  const [saved, setSaved] = useState(false);
  const form = useForm<z.infer<typeof farmInputSchema>>({
    resolver: zodResolver(farmInputSchema),
    values: {
      name: farm.name,
      code: farm.code,
      timezone: farm.timezone,
      locale: farm.locale,
      contactName: farm.contactName ?? '',
      contactPhone: farm.contactPhone ?? '',
      contactEmail: farm.contactEmail ?? '',
      addressLine: farm.addressLine ?? '',
      weightUnit: farm.weightUnit,
      volumeUnit: farm.volumeUnit,
    },
  });
  const mutation = useMutation({
    mutationFn: (values: z.infer<typeof farmInputSchema>) =>
      api(`/api/v1/farms/${farm.id}`, { method: 'PATCH', json: { ...values, version: farm.version } }),
    onSuccess: () => {
      setSaved(true);
      onSaved();
    },
    onError: (error) => applyFields(error, (name, err) => form.setError(name as 'name', err)),
  });
  const canEdit = farm.permissions.includes('farm.update');
  return (
    <div className="grid gap-4">
      <FarmForm
        title={t('farm.profileTitle')}
        body={t('farm.profileBody')}
        form={form}
        pending={mutation.isPending}
        error={mutation.isError ? mutation.error : null}
        saved={saved}
        readOnly={!canEdit}
        onSubmit={(values) => mutation.mutate(values)}
      />
      <Card>
        <h2 className="font-display text-2xl">{t('farms.title')}</h2>
        <ul className="mt-2 grid gap-2 text-sm">
          <li>{farm.shedCount > 0 ? t('farm.stepShedDone', { count: farm.shedCount }) : t('farm.stepShedTodo')}</li>
          <li>{farm.memberCount > 1 ? t('farm.stepPeopleDone', { count: farm.memberCount }) : t('farm.stepPeopleTodo')}</li>
        </ul>
      </Card>
    </div>
  );
}

function FarmForm({
  title,
  body,
  form,
  pending,
  error,
  saved,
  readOnly,
  onSubmit,
}: {
  title: string;
  body: string;
  form: ReturnType<typeof useForm<z.infer<typeof farmInputSchema>>>;
  pending: boolean;
  error: unknown;
  saved?: boolean;
  readOnly?: boolean;
  onSubmit: (values: z.infer<typeof farmInputSchema>) => void;
}) {
  const { t } = useTranslation();
  const errors = form.formState.errors;
  return (
    <Card className="grid gap-4">
      <div>
        <h1 className="font-display text-3xl font-semibold">{title}</h1>
        <p className="mt-1 text-ink-soft">{body}</p>
      </div>
      <form className="grid gap-3" onSubmit={form.handleSubmit(onSubmit)} noValidate>
        <Field id="name" label={t('farm.name')} error={text(t, errors.name?.message)}>
          <Input id="name" disabled={readOnly} {...form.register('name')} />
        </Field>
        <Field id="code" label={t('farm.code')} hint={t('farm.codeHint')} error={text(t, errors.code?.message)}>
          <Input id="code" disabled={readOnly} autoCapitalize="characters" {...form.register('code')} />
        </Field>
        <Field id="timezone" label={t('farm.timezone')} error={text(t, errors.timezone?.message)}>
          <Input id="timezone" list="timezones" disabled={readOnly} {...form.register('timezone')} />
          <datalist id="timezones">
            <option value="Asia/Kolkata" />
            <option value="Asia/Kathmandu" />
            <option value="Asia/Dhaka" />
            <option value="UTC" />
          </datalist>
        </Field>
        <Field id="locale" label={t('farm.locale')} error={text(t, errors.locale?.message)}>
          <select id="locale" className="min-h-11 rounded-xl border border-line bg-white px-3" disabled={readOnly} {...form.register('locale')}>
            <option value="en">English</option>
            <option value="hi">हिन्दी</option>
            <option value="mr">मराठी</option>
          </select>
        </Field>
        <Field id="contactName" label={t('farm.contactName')} error={text(t, errors.contactName?.message)}>
          <Input id="contactName" disabled={readOnly} {...form.register('contactName')} />
        </Field>
        <Field id="contactPhone" label={t('farm.contactPhone')} error={text(t, errors.contactPhone?.message)}>
          <Input id="contactPhone" inputMode="tel" disabled={readOnly} {...form.register('contactPhone')} />
        </Field>
        <Field id="contactEmail" label={t('farm.contactEmail')} error={text(t, errors.contactEmail?.message)}>
          <Input id="contactEmail" type="email" disabled={readOnly} {...form.register('contactEmail')} />
        </Field>
        <Field id="addressLine" label={t('farm.address')} error={text(t, errors.addressLine?.message)}>
          <Input id="addressLine" disabled={readOnly} {...form.register('addressLine')} />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field id="weightUnit" label={t('farm.weightUnit')} error={text(t, errors.weightUnit?.message)}>
            <select id="weightUnit" className="min-h-11 rounded-xl border border-line bg-white px-3" disabled={readOnly} {...form.register('weightUnit')}>
              {WEIGHT_UNITS.map((unit) => (
                <option key={unit} value={unit}>
                  {unit}
                </option>
              ))}
            </select>
          </Field>
          <Field id="volumeUnit" label={t('farm.volumeUnit')} error={text(t, errors.volumeUnit?.message)}>
            <select id="volumeUnit" className="min-h-11 rounded-xl border border-line bg-white px-3" disabled={readOnly} {...form.register('volumeUnit')}>
              {VOLUME_UNITS.map((unit) => (
                <option key={unit} value={unit}>
                  {unit}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <p className="rounded-xl bg-gold/30 px-3 py-2 text-sm">{t('farm.unitsNote')}</p>
        {error ? <Alert>{explain(error, t)}</Alert> : null}
        {saved ? <Alert tone="ok">{t('farm.saved')}</Alert> : null}
        {readOnly ? null : (
          <Button type="submit" disabled={pending}>
            {pending ? t('farm.saving') : t('farm.save')}
          </Button>
        )}
      </form>
    </Card>
  );
}

export function ShedsPage() {
  const { farmId = '' } = useParams();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Shed | null>(null);
  const farms = useQuery({ queryKey: ['farms'], queryFn: () => api<FarmSummary[]>('/api/v1/farms') });
  const access = farms.data?.find((farm) => farm.id === farmId);
  const sheds = useQuery({ queryKey: ['sheds', farmId], queryFn: () => api<Shed[]>(`/api/v1/farms/${farmId}/sheds`) });
  const canEdit = Boolean(access?.permissions.includes('shed.create'));

  if (sheds.isLoading) return <p>{t('common.loading')}</p>;
  if (sheds.isError || !sheds.data) return <Alert>{explain(sheds.error, t)}</Alert>;

  return (
    <div className="grid gap-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold">{t('sheds.title')}</h1>
          <p className="mt-1 text-ink-soft">{t('sheds.body')}</p>
        </div>
        {canEdit ? (
          <Button type="button" variant="outline" onClick={() => { setEditing(null); setOpen((value) => !value); }}>
            {open ? t('sheds.hideForm') : t('sheds.add')}
          </Button>
        ) : null}
      </div>
      <p className="text-sm text-ink-soft">{t('sheds.typeNote')}</p>
      {open || editing ? (
        <ShedForm
          farmId={farmId}
          shed={editing}
          onDone={() => {
            setOpen(false);
            setEditing(null);
            void queryClient.invalidateQueries({ queryKey: ['sheds', farmId] });
            void queryClient.invalidateQueries({ queryKey: ['farm', farmId] });
          }}
          onCancel={() => { setOpen(false); setEditing(null); }}
        />
      ) : null}
      {sheds.data.length === 0 ? (
        <Card>
          <h2 className="font-display text-2xl">{t('sheds.emptyTitle')}</h2>
          <p className="text-ink-soft">{t('sheds.emptyBody')}</p>
        </Card>
      ) : (
        <div className="grid gap-3">
          {sheds.data.map((shed) => (
            <Card key={shed.id}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-ink-soft">{shed.code}</p>
                  <h2 className="font-display text-2xl">{shed.name}</h2>
                  <p className="text-sm">
                    {t(`sheds.type.${shed.shedType}`, { defaultValue: shed.shedType })} · {shed.usableCapacity} {t('sheds.capacityBirds')} · {t(`sheds.status.${shed.status}`)}
                  </p>
                  {shed.notes ? <p className="mt-1 text-sm text-ink-soft">{shed.notes}</p> : null}
                </div>
                {access?.permissions.includes('shed.update') ? (
                  <Button type="button" variant="ghost" onClick={() => { setEditing(shed); setOpen(false); }}>
                    {t('sheds.edit')}
                  </Button>
                ) : null}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function ShedForm({ farmId, shed, onDone, onCancel }: { farmId: string; shed: Shed | null; onDone: () => void; onCancel: () => void }) {
  const { t } = useTranslation();
  const form = useForm<z.infer<typeof shedInputSchema>>({
    resolver: zodResolver(shedInputSchema),
    values: {
      code: shed?.code ?? '',
      name: shed?.name ?? '',
      shedType: (shed?.shedType as z.infer<typeof shedInputSchema>['shedType']) ?? 'brooder',
      usableCapacity: shed?.usableCapacity ?? 0,
      status: shed?.status ?? 'active',
      notes: shed?.notes ?? '',
    },
  });
  const mutation = useMutation({
    mutationFn: (values: z.infer<typeof shedInputSchema>) =>
      shed
        ? api(`/api/v1/farms/${farmId}/sheds/${shed.id}`, { method: 'PATCH', json: { ...values, version: shed.version } })
        : api(`/api/v1/farms/${farmId}/sheds`, { method: 'POST', json: values }),
    onSuccess: onDone,
    onError: (error) => applyFields(error, (name, err) => form.setError(name as 'name', err)),
  });
  const errors = form.formState.errors;
  return (
    <Card>
      <form className="grid gap-3" onSubmit={form.handleSubmit((values) => mutation.mutate(values))} noValidate>
        <Field id="shed-code" label={t('sheds.code')} error={text(t, errors.code?.message)}>
          <Input id="shed-code" {...form.register('code')} />
        </Field>
        <Field id="shed-name" label={t('sheds.name')} error={text(t, errors.name?.message)}>
          <Input id="shed-name" {...form.register('name')} />
        </Field>
        <Field id="shed-type" label={t('sheds.type')} error={text(t, errors.shedType?.message)}>
          <select id="shed-type" className="min-h-11 rounded-xl border border-line bg-white px-3" {...form.register('shedType')}>
            {SHED_TYPES.map((type) => (
              <option key={type} value={type}>
                {t(`sheds.type.${type}`)}
              </option>
            ))}
          </select>
        </Field>
        <Field id="capacity" label={t('sheds.capacity')} hint={t('sheds.capacityBirds')} error={text(t, errors.usableCapacity?.message)}>
          <Input id="capacity" type="number" min={0} inputMode="numeric" {...form.register('usableCapacity', { valueAsNumber: true })} />
        </Field>
        <Field id="status" label={t('sheds.status')} error={text(t, errors.status?.message)}>
          <select id="status" className="min-h-11 rounded-xl border border-line bg-white px-3" {...form.register('status')}>
            {SHED_STATUSES.map((status) => (
              <option key={status} value={status}>
                {t(`sheds.status.${status}`)}
              </option>
            ))}
          </select>
        </Field>
        <Field id="notes" label={`${t('sheds.notes')} (${t('common.optional')})`} error={text(t, errors.notes?.message)}>
          <TextArea id="notes" {...form.register('notes')} />
        </Field>
        <p className="text-xs text-ink-soft">{CAPACITY_UNIT}</p>
        {mutation.isError ? <Alert>{explain(mutation.error, t)}</Alert> : null}
        <div className="flex gap-2">
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? t('sheds.saving') : t('sheds.save')}
          </Button>
          <Button type="button" variant="outline" onClick={onCancel}>
            {t('sheds.cancel')}
          </Button>
        </div>
      </form>
    </Card>
  );
}

export function PeoplePage() {
  const { farmId = '' } = useParams();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const me = useQuery({ queryKey: ['me'], queryFn: () => api<{ id: string }>('/api/v1/auth/me') });
  const farms = useQuery({ queryKey: ['farms'], queryFn: () => api<FarmSummary[]>('/api/v1/farms') });
  const members = useQuery({ queryKey: ['members', farmId], queryFn: () => api<Member[]>(`/api/v1/farms/${farmId}/members`) });
  const access = farms.data?.find((farm) => farm.id === farmId);
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState<{ id: string; kind: 'revoke' | 'deactivate' } | null>(null);

  if (members.isLoading) return <p>{t('common.loading')}</p>;
  if (members.isError || !members.data) return <Alert>{explain(members.error, t)}</Alert>;

  async function update(id: string, json: Record<string, unknown>) {
    await api(`/api/v1/farms/${farmId}/members/${id}`, { method: 'PATCH', json });
    setConfirm(null);
    await queryClient.invalidateQueries({ queryKey: ['members', farmId] });
    await queryClient.invalidateQueries({ queryKey: ['farm', farmId] });
  }

  return (
    <div className="grid gap-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold">{t('people.title')}</h1>
          <p className="mt-1 text-ink-soft">{t('people.body')}</p>
        </div>
        {access?.permissions.includes('user.manage') ? (
          <Button type="button" variant="outline" onClick={() => setOpen((value) => !value)}>
            {open ? t('people.hideForm') : t('people.invite')}
          </Button>
        ) : null}
      </div>
      {open ? <InviteForm farmId={farmId} onDone={() => { setOpen(false); void queryClient.invalidateQueries({ queryKey: ['members', farmId] }); }} /> : null}
      {members.data.length === 0 ? (
        <Card>
          <h2 className="font-display text-2xl">{t('people.emptyTitle')}</h2>
          <p className="text-ink-soft">{t('people.emptyBody')}</p>
        </Card>
      ) : (
        <div className="grid gap-3">
          {members.data.map((member) => (
            <Card key={member.id}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-display text-2xl">
                    {member.displayName} {member.userId === me.data?.id ? <span className="text-base text-ink-soft">({t('people.you')})</span> : null}
                  </h2>
                  <p className="text-sm text-ink-soft">{member.email}</p>
                  <p className="text-sm font-semibold">
                    {t(`role.${member.role}`)}
                    {member.status === 'revoked' ? ` · ${t('people.revokedLabel')}` : ''}
                    {member.userStatus === 'deactivated' ? ` · ${t('people.deactivatedLabel')}` : ''}
                  </p>
                  {member.grants.length > 0 ? (
                    <p className="mt-1 text-sm">{member.grants.map((grant) => t(`permission.${grant}`, { defaultValue: grant })).join(', ')}</p>
                  ) : null}
                </div>
              </div>
              {access?.permissions.includes('user.manage') ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {member.status === 'active' ? (
                    <Button type="button" variant="outline" onClick={() => setConfirm({ id: member.id, kind: 'revoke' })}>
                      {t('people.revoke')}
                    </Button>
                  ) : (
                    <Button type="button" variant="outline" onClick={() => void update(member.id, { status: 'active' })}>
                      {t('people.restore')}
                    </Button>
                  )}
                  {access.role === 'owner' && member.userStatus === 'active' && member.userId !== me.data?.id ? (
                    <Button type="button" variant="clay" onClick={() => setConfirm({ id: member.id, kind: 'deactivate' })}>
                      {t('people.deactivate')}
                    </Button>
                  ) : null}
                  {access.role === 'owner' && member.userStatus === 'deactivated' ? (
                    <Button type="button" variant="outline" onClick={() => void update(member.id, { reactivateUser: true })}>
                      {t('people.reactivate')}
                    </Button>
                  ) : null}
                </div>
              ) : null}
              {confirm?.id === member.id ? (
                <div className="mt-3 grid gap-2 rounded-xl bg-paper-deep p-3">
                  <p>{confirm.kind === 'revoke' ? t('people.revokeBody') : t('people.deactivateBody')}</p>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="clay"
                      onClick={() => void update(member.id, confirm.kind === 'revoke' ? { status: 'revoked' } : { deactivateUser: true })}
                    >
                      {confirm.kind === 'revoke' ? t('people.confirmRevoke') : t('people.confirmDeactivate')}
                    </Button>
                    <Button type="button" variant="outline" onClick={() => setConfirm(null)}>
                      {t('people.cancel')}
                    </Button>
                  </div>
                </div>
              ) : null}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function InviteForm({ farmId, onDone }: { farmId: string; onDone: () => void }) {
  const { t } = useTranslation();
  const [notice, setNotice] = useState<string | null>(null);
  const form = useForm<z.infer<typeof inviteSchema>>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { email: '', displayName: '', password: '', role: 'worker', permissionGrants: [] },
  });
  const role = form.watch('role');
  const mutation = useMutation({
    mutationFn: (values: z.infer<typeof inviteSchema>) =>
      api<{ userCreated: boolean }>(`/api/v1/farms/${farmId}/members`, {
        method: 'POST',
        json: { ...values, permissionGrants: values.role === 'family_helper' ? values.permissionGrants : [] },
      }),
    onSuccess: (result) => {
      setNotice(result.userCreated ? t('people.invited') : t('people.linked'));
      onDone();
    },
    onError: (error) => applyFields(error, (name, err) => form.setError(name as 'email', err)),
  });
  const errors = form.formState.errors;
  return (
    <Card>
      <form className="grid gap-3" onSubmit={form.handleSubmit((values) => mutation.mutate(values))} noValidate>
        <Field id="person-name" label={t('people.name')} error={text(t, errors.displayName?.message)}>
          <Input id="person-name" {...form.register('displayName')} />
        </Field>
        <Field id="person-email" label={t('people.email')} error={text(t, errors.email?.message)}>
          <Input id="person-email" type="email" {...form.register('email')} />
        </Field>
        <Field id="person-password" label={t('people.temporaryPassword')} hint={t('auth.passwordHint')} error={text(t, errors.password?.message)}>
          <Input id="person-password" type="password" autoComplete="new-password" {...form.register('password')} />
        </Field>
        <Field id="person-role" label={t('people.role')} error={text(t, errors.role?.message)}>
          <select id="person-role" className="min-h-11 rounded-xl border border-line bg-white px-3" {...form.register('role')}>
            {(['owner', 'manager', 'worker', 'family_helper', 'vet_advisor'] as const).map((item) => (
              <option key={item} value={item}>
                {t(`role.${item}`)}
              </option>
            ))}
          </select>
        </Field>
        {role === 'family_helper' ? (
          <fieldset className="grid gap-2">
            <legend className="text-sm font-semibold">{t('people.grants')}</legend>
            <p className="text-sm text-ink-soft">{t('people.grantsHint')}</p>
            {PERMISSIONS.map((permission) => (
              <label key={permission} className="flex min-h-11 items-center gap-2 text-sm">
                <input type="checkbox" value={permission} {...form.register('permissionGrants')} />
                {t(`permission.${permission}`)}
              </label>
            ))}
          </fieldset>
        ) : null}
        {mutation.isError ? <Alert>{explain(mutation.error, t)}</Alert> : null}
        {notice ? <Alert tone="ok">{notice}</Alert> : null}
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? t('people.saving') : t('people.save')}
        </Button>
      </form>
    </Card>
  );
}

export function ActivityPage() {
  const { farmId = '' } = useParams();
  const { t, i18n } = useTranslation();
  const audit = useQuery({ queryKey: ['audit', farmId], queryFn: () => api<AuditPage>(`/api/v1/farms/${farmId}/audit`) });
  if (audit.isLoading) return <p>{t('common.loading')}</p>;
  if (audit.isError || !audit.data) return <Alert>{explain(audit.error, t)}</Alert>;
  return (
    <div className="grid gap-4">
      <div>
        <h1 className="font-display text-3xl font-semibold">{t('activity.title')}</h1>
        <p className="mt-1 text-ink-soft">{t('activity.body')}</p>
      </div>
      {audit.data.items.length === 0 ? (
        <Card>
          <p>{t('activity.empty')}</p>
        </Card>
      ) : (
        <ol className="grid gap-3">
          {audit.data.items.map((item) => {
            const summary = item.summary;
            const email = typeof summary.email === 'string' ? summary.email : '';
            const code = typeof summary.code === 'string' ? summary.code : '';
            const name = typeof summary.name === 'string' ? summary.name : '';
            const roleCode = typeof summary.role === 'string' ? summary.role : '';
            const changed = Array.isArray(summary.changed) ? summary.changed.filter((value): value is string => typeof value === 'string').join(', ') : '';
            const when = new Intl.DateTimeFormat(i18n.language, {
              dateStyle: 'medium',
              timeStyle: 'short',
              timeZone: audit.data?.timezone || 'UTC',
            }).format(new Date(item.createdAt));
            return (
              <li key={item.id}>
                <Card>
                  <p className="font-semibold">
                    {t(`activity.action.${item.action}`, {
                      email,
                      code,
                      name,
                      role: roleCode ? t(`role.${roleCode}`, { defaultValue: roleCode }) : '',
                      changed,
                      defaultValue: item.action,
                    })}
                  </p>
                  <p className="text-sm text-ink-soft">
                    {when}
                    {item.actorName ? ` · ${t('activity.by', { name: item.actorName })}` : ''}
                  </p>
                </Card>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
