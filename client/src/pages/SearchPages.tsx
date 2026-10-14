import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { Alert, Button, Card, Field, Input } from '@/components/ui';
import { ApiError, api, errorKey } from '@/lib/api';

type SearchPage = { query: string; hits: Array<{ kind: string; id: string; label: string }> };

function explain(error: unknown, t: (key: string) => string) {
  if (error instanceof ApiError) {
    if (error.details?.fields?.q === 'too_small') return t('search.short');
    if (error.status === 403) return t('common.permissionDenied');
    const key = errorKey(error);
    return key ? t(key) : t('common.errorGeneric');
  }
  return t('common.errorGeneric');
}

export function SearchPageView() {
  const { farmId = '' } = useParams();
  const { t } = useTranslation();
  const [text, setText] = useState('');
  const [page, setPage] = useState<SearchPage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if ([...text.trim()].length < 2) {
      setPage(null);
      setError(t('search.short'));
      return;
    }
    setPending(true);
    setError(null);
    try {
      setPage(await api<SearchPage>(`/api/v1/farms/${farmId}/search?q=${encodeURIComponent(text.trim())}`));
    } catch (caught) {
      setPage(null);
      setError(explain(caught, t));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="grid gap-4">
      <div>
        <h1 className="font-display text-3xl font-semibold">{t('search.title')}</h1>
        <p className="mt-1 text-ink-soft">{t('search.body')}</p>
      </div>
      <Card>
        <form className="grid gap-3" onSubmit={(event) => void onSubmit(event)}>
          <Field id="search-q" label={t('search.label')} hint={t('fieldHint.search-q')}>
            <Input id="search-q" value={text} placeholder={t('fieldPh.search-q')} onChange={(event) => setText(event.target.value)} />
          </Field>
          {error ? <Alert>{error}</Alert> : null}
          <Button type="submit">{pending ? t('search.working') : t('search.action')}</Button>
        </form>
      </Card>
      {page && page.hits.length === 0 ? (
        <Card>
          <h2 className="font-display text-2xl">{t('search.emptyTitle')}</h2>
          <p className="text-ink-soft">{t('search.emptyBody')}</p>
        </Card>
      ) : null}
      {page?.hits.map((hit) => (
        <Card key={`${hit.kind}-${hit.id}`}>
          <p className="text-sm text-ink-soft">{t(`search.kind.${hit.kind}`)}</p>
          <p className="font-semibold">{hit.label}</p>
        </Card>
      ))}
    </div>
  );
}
