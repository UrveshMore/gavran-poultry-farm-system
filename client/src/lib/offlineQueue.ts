import { applySyncResult, captureClass, enqueueCapture, syncMode, type QueueItem } from '@gavran/shared';
import { ApiError, api } from '@/lib/api';

const LEGACY_KEY = 'gavran.offlineQueue';
const DB_NAME = 'gavran';
const STORE = 'queue';

const listeners = new Set<() => void>();

export function subscribeQueue(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function emit() {
  for (const listener of listeners) listener();
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function legacyRows(): Promise<QueueItem[]> {
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as QueueItem[]) : [];
  } catch {
    return [];
  }
}

export async function readQueue(): Promise<QueueItem[]> {
  const db = await openDb();
  const stored = await new Promise<QueueItem[]>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const request = tx.objectStore(STORE).getAll();
    request.onsuccess = () => resolve((request.result as QueueItem[]) ?? []);
    request.onerror = () => reject(request.error);
  });
  if (stored.length > 0) return stored;
  const old = await legacyRows();
  if (old.length === 0) return [];
  await writeAll(old);
  localStorage.removeItem(LEGACY_KEY);
  return old;
}

async function writeAll(items: QueueItem[]) {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    store.clear();
    for (const item of items) store.put(item);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  emit();
}

export async function removeQueued(id: string) {
  const rows = (await readQueue()).filter((row) => row.id !== id);
  await writeAll(rows);
}

export async function waitingCount(): Promise<number> {
  const rows = await readQueue();
  return rows.filter((row) => row.state === 'pending' || row.state === 'failed' || row.state === 'syncing').length;
}

export async function queueWrite(farmId: string, path: string, body: unknown, idempotencyKey = crypto.randomUUID()): Promise<'queued' | 'refused' | 'online_only'> {
  const next = enqueueCapture(await readQueue(), {
    id: crypto.randomUUID(),
    farmId,
    path,
    body,
    idempotencyKey,
  });
  if (next.result === 'queued') await writeAll(next.items);
  return next.result;
}

export function queueAttendance(farmId: string, body: unknown) {
  return queueWrite(farmId, `/api/v1/farms/${farmId}/attendance`, body);
}

export async function postOrQueue(farmId: string, path: string, body: unknown): Promise<'sent' | 'queued'> {
  const idempotencyKey = crypto.randomUUID();
  const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
  if ((offline || captureClass(path) === 'queueable') && offline) {
    const outcome = await queueWrite(farmId, path, body, idempotencyKey);
    if (outcome === 'queued') return 'queued';
  }
  try {
    await api(path, { method: 'POST', json: body, idempotencyKey });
    return 'sent';
  } catch (error) {
    if (!(error instanceof ApiError) && captureClass(path) === 'queueable') {
      const outcome = await queueWrite(farmId, path, body, idempotencyKey);
      if (outcome === 'queued') return 'queued';
    }
    throw error;
  }
}

let flushing = false;

export async function flushQueue(): Promise<void> {
  if (flushing || (typeof navigator !== 'undefined' && navigator.onLine === false)) return;
  flushing = true;
  try {
    const rows = await readQueue();
    let changed = false;
    const next = [];
    for (const item of rows) {
      if (item.state !== 'pending' && item.state !== 'failed') {
        next.push(item);
        continue;
      }
      try {
        await api(item.path, { method: 'POST', json: item.body, idempotencyKey: item.idempotencyKey });
        next.push(applySyncResult({ ...item, state: 'syncing' }, 200, syncMode(item.path)));
      } catch (error) {
        const status = error instanceof ApiError ? error.status : 0;
        if (status === 0) {
          next.push(item);
          break;
        }
        next.push(applySyncResult({ ...item, state: 'syncing' }, status, syncMode(item.path)));
      }
      changed = true;
    }
    if (changed) await writeAll(next);
  } finally {
    flushing = false;
  }
}
