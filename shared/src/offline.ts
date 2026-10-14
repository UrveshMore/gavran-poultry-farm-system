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
  'medicine-records',
  'suppliers',
  'purchase-orders',
  'goods-receipts',
  'supplier-bills',
  'supplier-payments',
] as const;

const QUEUEABLE = ['attendance', 'eggs', 'doses', 'tasks', 'complete', 'losses'] as const;

const KEY_PATTERN = /^[\x21-\x7e]{8,80}$/;

export function pathLeaf(path: string): string {
  const clean = (path.split('?')[0] ?? path).replace(/\/+$/, '');
  return clean.split('/').pop() ?? '';
}

/** Decision 10 stays open. Eggs, dose ticks, jobs, losses, and attendance may wait. Money and feed do not. */
export function captureClass(path: string): CaptureClass {
  const leaf = pathLeaf(path);
  if ((REFUSED as readonly string[]).includes(leaf)) return 'refused';
  if ((QUEUEABLE as readonly string[]).includes(leaf)) return 'queueable';
  return 'online_only';
}

export function syncMode(path: string): 'keep' | 'last_write' {
  return pathLeaf(path) === 'attendance' ? 'keep' : 'last_write';
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

/**
 * Attendance keeps a 409 on the device.
 * Other queued writes use last-write: the body stays, the row is marked sent, and detail is `changed`.
 */
export function applySyncResult(item: QueueItem, status: number, mode: 'keep' | 'last_write' = 'keep'): QueueItem {
  if (item.state === 'conflict' || item.state === 'synced') return item;
  if (status >= 200 && status < 300) return { ...item, state: 'synced', detail: '' };
  if (status === 409 && mode === 'last_write') return { ...item, state: 'synced', detail: 'changed' };
  if (status === 409) return { ...item, state: 'conflict', detail: 'conflict' };
  return { ...item, state: 'failed', detail: String(status) };
}
