import { notificationInputSchema } from '@gavran/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { z } from 'zod';
import { Alert, Button, Card, Field, Input, TextArea } from '@/components/ui';
import { ApiError, api, errorKey, fetchMe } from '@/lib/api';
import type { FarmSummary, Member } from '@/lib/types';

const selectClass = 'min-h-11 w-full rounded-xl border border-line bg-white px-3';

type NoticePage = {
  notices: Array<{ id: string; userId: string; displayName: string; title: string; body: string; readAt: string | null }>;
  delivery: 'in_app';
  urgent: { status: 'not_chosen'; reason: string };
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

export function NoticesPage() {
  const { farmId = '' } = useParams();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const me = useQuery({ queryKey: ['me'], queryFn: fetchMe });
  const farms = useQuery({ queryKey: ['farms'], queryFn: () => api<FarmSummary[]>('/api/v1/farms') });
  const access = farms.data?.find((farm) => farm.id === farmId);
  const page = useQuery({ queryKey: ['notices', farmId], queryFn: () => api<NoticePage>(`/api/v1/farms/${farmId}/notifications`) });
  const members = useQuery({
    queryKey: ['members', farmId],
    queryFn: () => api<Member[]>(`/api/v1/farms/${farmId}/members`),
    enabled: Boolean(access?.permissions.includes('user.read')),
  });
  const canWrite = Boolean(access?.permissions.includes('notification.write'));
  const form = useForm<z.infer<typeof notificationInputSchema>>({
    resolver: zodResolver(notificationInputSchema),
    defaultValues: { userId: '', title: '', body: '' },
  });
  const save = useMutation({
    mutationFn: (values: z.infer<typeof notificationInputSchema>) => api(`/api/v1/farms/${farmId}/notifications`, { method: 'POST', json: values }),
    onSuccess: () => {
      form.reset({ userId: '', title: '', body: '' });
      void queryClient.invalidateQueries({ queryKey: ['notices', farmId] });
    },
  });
  const read = useMutation({
    mutationFn: (id: string) => api(`/api/v1/farms/${farmId}/notifications/${id}/read`, { method: 'POST', json: {} }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['notices', farmId] }),
  });

  if (page.isLoading) return <p>{t('common.loading')}</p>;
  if (page.isError || !page.data) return <Alert>{explain(page.error, t)}</Alert>;

  return (
    <div className="grid gap-4">
      <div>
        <h1 className="font-display text-3xl font-semibold">{t('notices.title')}</h1>
        <p className="mt-1 text-ink-soft">{t('notices.body')}</p>
      </div>
      <p className="rounded-xl bg-gold/30 px-3 py-2 text-sm">{t('notices.inApp')}</p>
      {page.data.notices.length === 0 ? (
        <Card>
          <h2 className="font-display text-2xl">{t('notices.emptyTitle')}</h2>
          <p className="text-ink-soft">{t('notices.emptyBody')}</p>
        </Card>
      ) : page.data.notices.map((notice) => (
        <Card key={notice.id}>
          <p className="font-semibold">{notice.title}</p>
          <p className="text-sm text-ink-soft">{notice.displayName}</p>
          <p>{notice.body}</p>
          <p className="text-sm">{notice.readAt ? t('notices.read') : t('notices.unread')}</p>
          {!notice.readAt && notice.userId === me.data?.id ? <Button type="button" className="mt-2" onClick={() => read.mutate(notice.id)}>{t('notices.markRead')}</Button> : null}
        </Card>
      ))}
      {canWrite ? (
        <Card>
          <form className="grid gap-3" onSubmit={form.handleSubmit((values) => save.mutate(values))}>
            <h2 className="font-display text-2xl">{t('notices.add')}</h2>
            <Field id="note-person" label={t('notices.person')} hint={t('fieldHint.note-person')}>
              <select id="note-person" className={selectClass} {...form.register('userId')}>
                <option value="">{t('notices.choose')}</option>
                {(members.data ?? []).filter((member) => member.status === 'active').map((member) => (
                  <option key={member.userId} value={member.userId}>{member.displayName}</option>
                ))}
              </select>
            </Field>
            <Field id="note-title" label={t('notices.subject')} hint={t('fieldHint.note-title')}><Input id="note-title" {...form.register('title')}  placeholder={t('fieldPh.note-title')}/></Field>
            <Field id="note-body" label={t('notices.message')} hint={t('fieldHint.note-body')}><TextArea id="note-body" {...form.register('body')}  placeholder={t('fieldPh.note-body')}/></Field>
            {save.isError ? <Alert>{explain(save.error, t)}</Alert> : null}
            <Button type="submit">{save.isPending ? t('notices.saving') : t('notices.save')}</Button>
          </form>
        </Card>
      ) : null}
    </div>
  );
}
