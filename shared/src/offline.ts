export const OFFLINE_DECISION = 'decision 10 is open' as const;

export type CaptureClass = 'refused' | 'queueable' | 'online_only';
export type QueueState = 'pending' | 'syncing' | 'synced' | 'conflict' | 'failed';

export type QueueItem = {
  id: string;
  farmId: string;
  path: string;
  body: unknown;
  idempotencyKey: string;
  state: QueueState;
  detail: string;
};

const REFUSED = [
  'stock-items',
  'stock-movements',
  'expenses',
  'expense-categories',
  'invoices',
  'invoice-documents',
  'orders',
  'market-prices',
  'losses',
  'medicine-records',
  'suppliers',
  'purchase-orders',
  'goods-receipts',
  'supplier-bills',
  'supplier-payments',
] as const;

const KEY_PATTERN = /^[\x21-\x7e]{8,80}$/;

/** Decision 10 is open, so only an attendance post may wait on the device. */
export function captureClass(path: string): CaptureClass {
  const clean = (path.split('?')[0] ?? path).replace(/\/+$/, '');
  const leaf = clean.split('/').pop() ?? '';
  if ((REFUSED as readonly string[]).includes(leaf)) return 'refused';
  if (leaf === 'attendance') return 'queueable';
  return 'online_only';
}

export function enqueueCapture(
  items: readonly QueueItem[],
  input: { id: string; farmId: string; path: string; body: unknown; idempotencyKey: string },
): { items: QueueItem[]; result: 'queued' | 'refused' | 'online_only' } {
  const kind = captureClass(input.path);
  if (kind !== 'queueable' || !KEY_PATTERN.test(input.idempotencyKey)) {
    return { items: [...items], result: kind === 'queueable' ? 'refused' : kind };
  }
  return {
    items: [
      ...items,
      {
        id: input.id,
        farmId: input.farmId,
        path: input.path,
        body: input.body,
        idempotencyKey: input.idempotencyKey,
        state: 'pending',
        detail: '',
      },
    ],
    result: 'queued',
  };
}

/** A conflict stays on the device. The earlier server row is not replaced. */
export function applySyncResult(item: QueueItem, status: number): QueueItem {
  if (item.state === 'conflict' || item.state === 'synced') return item;
  if (status >= 200 && status < 300) return { ...item, state: 'synced', detail: '' };
  if (status === 409) return { ...item, state: 'conflict', detail: 'conflict' };
  return { ...item, state: 'failed', detail: String(status) };
}
