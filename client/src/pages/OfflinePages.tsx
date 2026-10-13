import type { QueueItem } from '@gavran/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { Alert, Button, Card } from '@/components/ui';
import { ApiError, api } from '@/lib/api';
import { finishQueued, readQueue, removeQueued, replaceQueued } from '@/lib/offlineQueue';

function labelKey(state: QueueItem['state']): string {
  if (state === 'pending') return 'offline.pending';
  if (state === 'syncing') return 'offline.syncing';
  if (state === 'synced') return 'offline.synced';
  if (state === 'conflict') return 'offline.conflict';
  return 'offline.failed';
}

export function OfflinePage() {
  const { farmId = '' } = useParams();
  const { t } = useTranslation();
  const [rows, setRows] = useState(() => readQueue().filter((row) => row.farmId === farmId));
  const [error, setError] = useState<string | null>(null);

  function refresh() {
    setRows(readQueue().filter((row) => row.farmId === farmId));
  }

  async function send(item: QueueItem) {
    if (item.state === 'conflict' || item.state === 'synced' || item.state === 'syncing') return;
    replaceQueued(item.id, { ...item, state: 'syncing' });
    refresh();
    try {
      await api(item.path, { method: 'POST', json: item.body, idempotencyKey: item.idempotencyKey });
      finishQueued({ ...item, state: 'syncing' }, 200);
    } catch (caught) {
      finishQueued({ ...item, state: 'syncing' }, caught instanceof ApiError ? caught.status : 0);
      if (!(caught instanceof ApiError)) setError(t('common.errorGeneric'));
    }
    refresh();
  }

  return (
    <div className="grid gap-4">
      <div>
        <h1 className="font-display text-3xl font-semibold">{t('offline.title')}</h1>
        <p className="mt-1 text-ink-soft">{t('offline.body')}</p>
      </div>
      <p className="rounded-xl bg-gold/30 px-3 py-2 text-sm">{t('offline.decision')}</p>
      <p className="rounded-xl bg-gold/30 px-3 py-2 text-sm">{t('offline.refused')}</p>
      {error ? <Alert>{error}</Alert> : null}
      {rows.length === 0 ? (
        <Card>
          <h2 className="font-display text-2xl">{t('offline.emptyTitle')}</h2>
          <p className="text-ink-soft">{t('offline.emptyBody')}</p>
        </Card>
      ) : (
        rows.map((row) => (
          <Card key={row.id}>
            <p className="font-semibold">{t('offline.attendance')}</p>
            <p>{t(labelKey(row.state))}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {row.state === 'pending' || row.state === 'failed' ? (
                <Button type="button" onClick={() => void send(row)}>
                  {t('offline.send')}
                </Button>
              ) : null}
              {row.state === 'conflict' || row.state === 'failed' || row.state === 'synced' ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    removeQueued(row.id);
                    refresh();
                  }}
                >
                  {t('offline.drop')}
                </Button>
              ) : null}
            </div>
          </Card>
        ))
      )}
    </div>
  );
}
