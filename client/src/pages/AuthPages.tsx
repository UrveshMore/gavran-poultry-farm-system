import { loginSchema, registerSchema, changePasswordSchema, pinLoginSchema } from '@gavran/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { z } from 'zod';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { PinPad } from '@/components/PinPad';
import { Alert, Button, Card, Field, Input, Logo } from '@/components/ui';
import { ApiError, api, errorKey, fetchMe } from '@/lib/api';
import type { PublicUser } from '@/lib/types';

function message(t: (key: string, options?: { defaultValue?: string }) => string, code?: string) {
  if (!code) return undefined;
  return t(`validation.${code}`, { defaultValue: t('validation.invalid') });
}

function describe(error: unknown, t: (key: string) => string) {
  if (error instanceof ApiError) {
    const key = errorKey(error);
    return key ? t(key) : t('common.errorGeneric');
  }
  return t('common.errorGeneric');
}

export function LoginPage() {
  const { t, i18n } = useTranslation();
  const [params] = useSearchParams();
  const queryClient = useQueryClient();
  const [ownerMode, setOwnerMode] = useState(false);
  const me = useQuery({ queryKey: ['me'], queryFn: fetchMe, retry: false });
  const bootstrap = useQuery({
    queryKey: ['bootstrap'],
    queryFn: () => api<{ bootstrapRequired: boolean }>('/api/v1/auth/bootstrap'),
    retry: false,
  });
  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });
  const mutation = useMutation({
    mutationFn: (values: z.infer<typeof loginSchema>) =>
      api<{ user: PublicUser }>('/api/v1/auth/login', { method: 'POST', json: values }),
    onSuccess: async (data) => {
      if (i18n.language !== data.user.preferredLocale) {
        await api('/api/v1/auth/me', { method: 'PATCH', json: { preferredLocale: i18n.language } });
      }
      await queryClient.invalidateQueries({ queryKey: ['me'] });
    },
  });

  if (me.data) return <Navigate to="/" replace />;

  return (
    <AuthFrame>
      <Card className="grid gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold">{t('auth.signInTitle')}</h1>
          <p className="mt-1 text-ink-soft">{ownerMode ? t('auth.ownerBody') : t('auth.workerBody')}</p>
        </div>
        {params.get('expired') === '1' ? <Alert>{t('auth.signInAgain')}</Alert> : null}
        {ownerMode ? (
          <form className="grid gap-3" onSubmit={form.handleSubmit((values) => mutation.mutate(values))} noValidate>
            <Field id="email" label={t('auth.email')} error={message(t, form.formState.errors.email?.message)} hint={t('fieldHint.email')}>
              <Input id="email" type="email" autoComplete="username" aria-invalid={Boolean(form.formState.errors.email)} {...form.register('email')} placeholder={t('fieldPh.email')} />
            </Field>
            <Field id="password" label={t('auth.password')} error={message(t, form.formState.errors.password?.message)} hint={t('fieldHint.password')}>
              <Input id="password" type="password" autoComplete="current-password" aria-invalid={Boolean(form.formState.errors.password)} {...form.register('password')} placeholder={t('fieldPh.password')} />
            </Field>
            {mutation.isError ? <Alert>{describe(mutation.error, t)}</Alert> : null}
            <Button type="submit" className="min-h-14" disabled={mutation.isPending}>
              {mutation.isPending ? t('auth.signingIn') : t('auth.signIn')}
            </Button>
          </form>
        ) : (
          <PinLogin
            onSuccess={async (user) => {
              if (i18n.language !== user.preferredLocale) {
                await api('/api/v1/auth/me', { method: 'PATCH', json: { preferredLocale: i18n.language } });
              }
              await queryClient.invalidateQueries({ queryKey: ['me'] });
            }}
          />
        )}
        <Button type="button" variant="outline" className="min-h-14" onClick={() => setOwnerMode((value) => !value)}>
          {ownerMode ? t('auth.workerToggle') : t('auth.ownerToggle')}
        </Button>
        {bootstrap.data?.bootstrapRequired ? (
          <p className="text-sm">
            {t('auth.bootstrapHint')}{' '}
            <Link className="font-semibold text-grove underline" to="/register">
              {t('auth.createOwner')}
            </Link>
          </p>
        ) : null}
      </Card>
    </AuthFrame>
  );
}

function PinLogin({ onSuccess }: { onSuccess: (user: PublicUser) => Promise<void> }) {
  const { t } = useTranslation();
  const [mobile, setMobile] = useState('');
  const [pin, setPin] = useState('');
  const [fieldError, setFieldError] = useState<string | undefined>();
  const mutation = useMutation({
    mutationFn: () => {
      const parsed = pinLoginSchema.safeParse({ mobile, pin });
      if (!parsed.success) {
        setFieldError(parsed.error.issues[0]?.message ?? 'invalid_format');
        return Promise.reject(new Error('invalid'));
      }
      setFieldError(undefined);
      return api<{ user: PublicUser }>('/api/v1/auth/pin-login', { method: 'POST', json: parsed.data });
    },
    onSuccess: async (data) => {
      await onSuccess(data.user);
    },
  });
  const ready = pinLoginSchema.safeParse({ mobile, pin }).success;

  return (
    <form
      className="grid gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (ready) mutation.mutate();
      }}
      noValidate
    >
      <Field id="mobile" label={t('auth.mobile')} error={fieldError ? message(t, fieldError) : undefined} hint={t('auth.mobileHint')}>
        <Input
          id="mobile"
          type="tel"
          inputMode="numeric"
          autoComplete="tel"
          className="min-h-14 text-2xl"
          value={mobile}
          onChange={(event) => setMobile(event.target.value)}
          placeholder={t('fieldPh.auth-mobile')}
        />
      </Field>
      <div>
        <p className="text-sm font-semibold">{t('auth.pin')}</p>
        <p className="text-sm text-ink-soft">{t('auth.pinHint')}</p>
      </div>
      <PinPad value={pin} onChange={setPin} backLabel={t('auth.pinBack')} />
      {mutation.isError && !(mutation.error instanceof Error && mutation.error.message === 'invalid') ? (
        <Alert>{describe(mutation.error, t)}</Alert>
      ) : null}
      <Button type="submit" className="min-h-14 text-lg" disabled={!ready || mutation.isPending}>
        {mutation.isPending ? t('auth.signingIn') : t('auth.signIn')}
      </Button>
    </form>
  );
}

export function RegisterPage() {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const locale = i18n.language === 'hi' || i18n.language === 'mr' ? i18n.language : 'en';
  const form = useForm<z.infer<typeof registerSchema>>({
    resolver: zodResolver(registerSchema),
    defaultValues: { email: '', password: '', displayName: '', preferredLocale: locale },
  });
  const mutation = useMutation({
    mutationFn: (values: z.infer<typeof registerSchema>) =>
      api('/api/v1/auth/register', { method: 'POST', json: { ...values, preferredLocale: locale } }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['me'] });
    },
  });
  if (mutation.isSuccess) return <Navigate to="/" replace />;

  return (
    <AuthFrame>
      <Card className="grid gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold">{t('auth.registerTitle')}</h1>
          <p className="mt-1 text-ink-soft">{t('auth.registerBody')}</p>
        </div>
        <form className="grid gap-3" onSubmit={form.handleSubmit((values) => mutation.mutate(values))} noValidate>
          <Field id="displayName" label={t('auth.displayName')} error={message(t, form.formState.errors.displayName?.message)} hint={t('fieldHint.displayName')}>
            <Input id="displayName" autoComplete="name" {...form.register('displayName')}  placeholder={t('fieldPh.displayName')}/>
          </Field>
          <Field id="email" label={t('auth.email')} error={message(t, form.formState.errors.email?.message)} hint={t('fieldHint.email')}>
            <Input id="email" type="email" autoComplete="username" {...form.register('email')}  placeholder={t('fieldPh.email')}/>
          </Field>
          <Field id="password" label={t('auth.password')} hint={t('auth.passwordHint')} error={message(t, form.formState.errors.password?.message)}>
            <Input id="password" type="password" autoComplete="new-password" {...form.register('password')}  placeholder={t('fieldPh.password')}/>
          </Field>
          {mutation.isError ? <Alert>{describe(mutation.error, t)}</Alert> : null}
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? t('auth.creating') : t('auth.createAccount')}
          </Button>
        </form>
        <p className="text-sm">
          <Link className="font-semibold text-grove underline" to="/login">
            {t('auth.haveAccount')}
          </Link>
        </p>
      </Card>
    </AuthFrame>
  );
}

export function AccountPage() {
  const { t } = useTranslation();
  const me = useQuery({ queryKey: ['me'], queryFn: fetchMe, retry: false });
  const [done, setDone] = useState(false);
  const form = useForm<z.infer<typeof changePasswordSchema>>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: '', newPassword: '' },
  });
  const mutation = useMutation({
    mutationFn: (values: z.infer<typeof changePasswordSchema>) =>
      api('/api/v1/auth/change-password', { method: 'POST', json: values }),
    onSuccess: () => {
      setDone(true);
      form.reset();
    },
  });

  return (
    <div className="grid gap-4">
      <div>
        <h1 className="font-display text-3xl font-semibold">{t('auth.accountTitle')}</h1>
        <p className="mt-1 text-ink-soft">{me.data ? me.data.displayName : t('auth.accountBody')}</p>
      </div>
      <Card className="grid gap-3">
        <h2 className="font-display text-2xl">{t('auth.changePassword')}</h2>
        <form className="grid gap-3" onSubmit={form.handleSubmit((values) => mutation.mutate(values))} noValidate>
          <Field id="currentPassword" label={t('auth.currentPassword')} error={message(t, form.formState.errors.currentPassword?.message)} hint={t('fieldHint.currentPassword')}>
            <Input id="currentPassword" type="password" autoComplete="current-password" {...form.register('currentPassword')}  placeholder={t('fieldPh.currentPassword')}/>
          </Field>
          <Field id="newPassword" label={t('auth.newPassword')} hint={t('auth.passwordHint')} error={message(t, form.formState.errors.newPassword?.message)}>
            <Input id="newPassword" type="password" autoComplete="new-password" {...form.register('newPassword')}  placeholder={t('fieldPh.newPassword')}/>
          </Field>
          {mutation.isError ? <Alert>{describe(mutation.error, t)}</Alert> : null}
          {done ? <Alert tone="ok">{t('auth.passwordChanged')}</Alert> : null}
          <Button type="submit" disabled={mutation.isPending}>
            {t('auth.changePassword')}
          </Button>
        </form>
      </Card>
      <p className="text-sm text-ink-soft">{t('lang.reviewNote')}</p>
    </div>
  );
}

function AuthFrame({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <section className="flex flex-col justify-between bg-grove px-6 py-8 text-paper">
        <Logo className="h-14 w-14" />
        <div>
          <p className="font-display text-4xl font-semibold">{t('app.name')}</p>
          <p className="mt-2 max-w-sm text-lg text-paper/90">{t('app.tagline')}</p>
        </div>
        <p className="max-w-sm text-sm text-paper/80">{t('lang.reviewNote')}</p>
      </section>
      <section className="flex flex-col gap-4 px-4 py-6">
        <div className="flex justify-end">
          <LanguageSwitcher />
        </div>
        <div className="mx-auto w-full max-w-md flex-1">{children}</div>
      </section>
    </div>
  );
}
