import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { Alert, Card } from '@/components/ui';
import { ApiError, api, errorKey } from '@/lib/api';
import type { Safeguards } from '@/lib/types';

function explain(error: unknown, t: (key: string) => string) {
  if (error instanceof ApiError) {
    if (error.status === 403) return t('common.permissionDenied');
    if (error.status === 404) return t('farm.notFound');
    const key = errorKey(error);
    return key ? t(key) : t('common.errorGeneric');
  }
  return t('common.errorGeneric');
}

export function SafeguardsPage() {
  const { farmId = '' } = useParams();
  const { t } = useTranslation();
  const page = useQuery({ queryKey: ['safeguards', farmId], queryFn: () => api<Safeguards>(`/api/v1/farms/${farmId}/safeguards`) });
  if (page.isLoading) return <p>{t('common.loading')}</p>;
  if (page.isError || !page.data) return <Alert>{explain(page.error, t)}</Alert>;
  return (
    <div className="grid gap-4">
      <div>
        <h1 className="font-display text-3xl font-semibold">{t('safeguards.title')}</h1>
        <p className="mt-1 text-ink-soft">{t('safeguards.body')}</p>
      </div>
      <Card>
        <h2 className="font-display text-2xl">{t('safeguards.retentionTitle')}</h2>
        <p>{t('safeguards.retentionBody')}</p>
      </Card>
      <Card>
        <h2 className="font-display text-2xl">{t('safeguards.recoveryTitle')}</h2>
        <p>{t('safeguards.recoveryBody')}</p>
      </Card>
      <Card>
        <h2 className="font-display text-2xl">{t('safeguards.backupTitle')}</h2>
        <p>{t('safeguards.backupBody', { database: page.data.backup.isolatedDatabase })}</p>
      </Card>
    </div>
  );
}
