import { applySyncResult, enqueueCapture, type QueueItem } from '@gavran/shared';

const KEY = 'gavran.offlineQueue';

export function readQueue(): QueueItem[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as QueueItem[]) : [];
  } catch {
    return [];
  }
}

function writeQueue(items: QueueItem[]) {
  localStorage.setItem(KEY, JSON.stringify(items));
}

export function queueAttendance(farmId: string, body: unknown): 'queued' | 'refused' | 'online_only' {
  const next = enqueueCapture(readQueue(), {
    id: crypto.randomUUID(),
    farmId,
    path: `/api/v1/farms/${farmId}/attendance`,
    body,
    idempotencyKey: crypto.randomUUID(),
  });
  if (next.result === 'queued') writeQueue(next.items);
  return next.result;
}

export function replaceQueued(id: string, item: QueueItem) {
  writeQueue(readQueue().map((row) => (row.id === id ? item : row)));
}

export function removeQueued(id: string) {
  writeQueue(readQueue().filter((row) => row.id !== id));
}

export function finishQueued(item: QueueItem, status: number) {
  replaceQueued(item.id, applySyncResult(item, status));
}
