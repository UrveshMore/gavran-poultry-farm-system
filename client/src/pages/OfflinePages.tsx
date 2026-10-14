import type { QueueItem } from '@gavran/shared';
import { pathLeaf } from '@gavran/shared';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { Alert, Button, Card } from '@/components/ui';
import { flushQueue, readQueue, removeQueued, subscribeQueue } from '@/lib/offlineQueue';

function labelKey(state: QueueItem['state']): string {
  if (state === 'pending') return 'offline.pending';
  if (state === 'syncing') return 'offline.syncing';
  if (state === 'synced') return 'offline.synced';
  if (state === 'conflict') return 'offline.conflict';
  return 'offline.failed';
}

function kindKey(path: string): string {
  const leaf = pathLeaf(path);
  if (leaf === 'eggs') return 'offline.eggs';
  if (leaf === 'doses') return 'offline.doses';
  if (leaf === 'tasks' || leaf === 'complete') return 'offline.tasks';
  if (leaf === 'losses') return 'offline.losses';
  return 'offline.attendance';
}

export function OfflinePage() {
  const { farmId = '' } = useParams();
  const { t } = useTranslation();
  const [rows, setRows] = useState<QueueItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const refresh = () => {
      void readQueue()
        .then((items) => setRows(items.filter((row) => row.farmId === farmId)))
        .catch(() => setError(t('common.errorGeneric')));
    };
    refresh();
    return subscribeQueue(refresh);
  }, [farmId, t]);

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
            <p className="font-semibold">{t(kindKey(row.path))}</p>
            <p>{t(labelKey(row.state))}</p>
            {row.detail === 'changed' ? <p>{t('offline.changed')}</p> : null}
            <div className="mt-2 flex flex-wrap gap-2">
              {row.state === 'pending' || row.state === 'failed' ? (
                <Button type="button" onClick={() => void flushQueue()}>
                  {t('offline.send')}
                </Button>
              ) : null}
              {row.state === 'conflict' || row.state === 'failed' || row.state === 'synced' ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    void removeQueued(row.id);
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
