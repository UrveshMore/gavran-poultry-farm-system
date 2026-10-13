import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { Alert, Button, Card, Field, Input } from '@/components/ui';

const fileClass =
  'min-h-11 w-full rounded-xl border border-line bg-white px-3 text-base text-ink file:mr-3 file:rounded-lg file:border-0 file:bg-paper-deep file:px-3 file:py-2 file:font-semibold';
import { ApiError, api, errorKey } from '@/lib/api';

type DocumentPage = {
  files: Array<{ id: string; originalName: string; mediaType: string; byteSize: number; note: string }>;
  scan: { status: 'not_claimed' };
  retention: { status: 'not_chosen'; reason: string };
};

function explain(error: unknown, t: (key: string) => string) {
  if (error instanceof ApiError) {
    if (error.details?.fields?.file === 'invalid_format') return t('documents.invalid');
    if (error.details?.fields?.file === 'required') return t('documents.required');
    if (error.status === 403) return t('common.permissionDenied');
    if (error.status === 404) return t('farm.notFound');
    const key = errorKey(error);
    return key ? t(key) : t('common.errorGeneric');
  }
  return t('common.errorGeneric');
}

export function DocumentsPage() {
  const { farmId = '' } = useParams();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [note, setNote] = useState('');
  const page = useQuery({ queryKey: ['documents', farmId], queryFn: () => api<DocumentPage>(`/api/v1/farms/${farmId}/documents`) });
  const save = useMutation({
    mutationFn: async () => {
      const file = fileRef.current?.files?.[0];
      if (!file) throw new ApiError(422, 'VALIDATION_ERROR', 'Choose a file.', { fields: { file: 'required' } });
      const form = new FormData();
      form.set('file', file);
      form.set('note', note);
      return api(`/api/v1/farms/${farmId}/documents`, { method: 'POST', form });
    },
    onSuccess: () => {
      setNote('');
      if (fileRef.current) fileRef.current.value = '';
      void queryClient.invalidateQueries({ queryKey: ['documents', farmId] });
    },
  });

  if (page.isLoading) return <p>{t('common.loading')}</p>;
  if (page.isError || !page.data) return <Alert>{explain(page.error, t)}</Alert>;

  return (
    <div className="grid gap-4">
      <div>
        <h1 className="font-display text-3xl font-semibold">{t('documents.title')}</h1>
        <p className="mt-1 text-ink-soft">{t('documents.body')}</p>
      </div>
      <p className="rounded-xl bg-gold/30 px-3 py-2 text-sm">{t('documents.scan')}</p>
      <p className="rounded-xl bg-gold/30 px-3 py-2 text-sm">{t('documents.retention')}</p>
      {page.data.files.length === 0 ? (
        <Card>
          <h2 className="font-display text-2xl">{t('documents.emptyTitle')}</h2>
          <p className="text-ink-soft">{t('documents.emptyBody')}</p>
        </Card>
      ) : (
        page.data.files.map((file) => (
          <Card key={file.id}>
            <p className="font-semibold">{file.originalName}</p>
            {file.note ? <p>{file.note}</p> : null}
            <p className="text-sm text-ink-soft">{t('documents.bytes', { count: file.byteSize })}</p>
            <a className="mt-2 inline-flex min-h-11 items-center font-semibold text-grove" href={`/api/v1/farms/${farmId}/documents/${file.id}/file`}>
              {t('documents.open')}
            </a>
          </Card>
        ))
      )}
      <Card>
        <form
          className="grid gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            save.mutate();
          }}
        >
          <h2 className="font-display text-2xl">{t('documents.add')}</h2>
          <Field id="doc-file" label={t('documents.choose')}>
            <input id="doc-file" ref={fileRef} className={fileClass} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" />
          </Field>
          <Field id="doc-note" label={t('documents.note')}>
            <Input id="doc-note" value={note} onChange={(event) => setNote(event.target.value)} />
          </Field>
          {save.isError ? <Alert>{explain(save.error, t)}</Alert> : null}
          <Button type="submit">{save.isPending ? t('documents.saving') : t('documents.save')}</Button>
        </form>
      </Card>
    </div>
  );
}
