import { OFFLINE_DECISION, applySyncResult, captureClass, enqueueCapture, syncMode, type QueueItem } from '@gavran/shared';
import { describe, expect, it } from 'vitest';

const farm = '11111111-1111-4111-8111-111111111111';

function queue(path: string) {
  return enqueueCapture([], {
    id: '22222222-2222-4222-8222-222222222222',
    farmId: farm,
    path,
    body: { note: 'yard' },
    idempotencyKey: 'attendance-key-1',
  });
}

describe('offline capture', () => {
  it('queues attendance, eggs, doses, jobs, and losses, and refuses stock and money', () => {
    expect(OFFLINE_DECISION).toBe('decision 10 is open');
    for (const leaf of ['attendance', 'eggs', 'doses', 'tasks', 'complete', 'losses']) {
      const saved = queue(`/api/v1/farms/${farm}/${leaf}`);
      expect(saved.result).toBe('queued');
      expect(saved.items[0]?.state).toBe('pending');
      expect(captureClass(`/api/v1/farms/${farm}/batches/x/${leaf}`)).toBe('queueable');
    }
    for (const leaf of [
      'stock-items',
      'stock-movements',
      'expenses',
      'invoices',
      'invoice-documents',
      'orders',
      'market-prices',
      'medicine-records',
      'suppliers',
      'supplier-bills',
      'supplier-payments',
    ]) {
      const refused = queue(`/api/v1/farms/${farm}/${leaf}`);
      expect(refused.result).toBe('refused');
      expect(refused.items).toEqual([]);
    }
    expect(captureClass(`/api/v1/farms/${farm}/egg-categories`)).toBe('online_only');
    expect(queue(`/api/v1/farms/${farm}/attendance?x=1`).result).toBe('queued');
  });

  it('keeps an attendance conflict on the device and does not replace the stored body', () => {
    const item = queue(`/api/v1/farms/${farm}/attendance`).items[0] as QueueItem;
    const conflict = applySyncResult(item, 409);
    expect(conflict.state).toBe('conflict');
    expect(conflict.body).toEqual(item.body);
    expect(applySyncResult(conflict, 200).state).toBe('conflict');
    expect(applySyncResult(item, 201).state).toBe('synced');
    expect(applySyncResult(item, 500).state).toBe('failed');
    expect(syncMode(item.path)).toBe('keep');
  });

  it('marks a last-write conflict as changed and keeps the queued body', () => {
    const item = queue(`/api/v1/farms/${farm}/eggs`).items[0] as QueueItem;
    const changed = applySyncResult(item, 409, 'last_write');
    expect(changed.state).toBe('synced');
    expect(changed.detail).toBe('changed');
    expect(changed.body).toEqual(item.body);
    expect(syncMode(`/api/v1/farms/${farm}/doses`)).toBe('last_write');
    expect(syncMode(`/api/v1/farms/${farm}/tasks`)).toBe('last_write');
    expect(syncMode(`/api/v1/farms/${farm}/losses`)).toBe('last_write');
  });
});
