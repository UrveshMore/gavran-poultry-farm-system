import { noticeGate, noticeResult } from '@gavran/shared';
import { describe, expect, it } from 'vitest';

describe('phone notice', () => {
  it('asks on a secure page and explains a plain network address', () => {
    expect(noticeGate({ secure: true, hasNotification: true })).toBe('ask');
    expect(noticeGate({ secure: false, hasNotification: true })).toBe('insecure');
    expect(noticeGate({ secure: true, hasNotification: false })).toBe('unsupported');
    expect(noticeGate({ secure: false, hasNotification: false })).toBe('insecure');
  });

  it('names the outcome after the browser answers', () => {
    expect(noticeResult({ permission: 'denied', alertCount: 2, shown: false })).toBe('denied');
    expect(noticeResult({ permission: 'default', alertCount: 2, shown: false })).toBe('denied');
    expect(noticeResult({ permission: 'granted', alertCount: 0, shown: false })).toBe('empty');
    expect(noticeResult({ permission: 'granted', alertCount: 1, shown: false })).toBe('failed');
    expect(noticeResult({ permission: 'granted', alertCount: 1, shown: true })).toBe('show');
  });
});
