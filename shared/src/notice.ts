export type NoticeGate = 'ask' | 'insecure' | 'unsupported';
export type NoticePermission = 'default' | 'granted' | 'denied';
export type NoticeResult = 'denied' | 'empty' | 'show' | 'failed';

/** Decide before calling the browser. A phone on plain http is not a secure page. */
export function noticeGate(input: { secure: boolean; hasNotification: boolean }): NoticeGate {
  if (!input.secure) return 'insecure';
  if (!input.hasNotification) return 'unsupported';
  return 'ask';
}

/** Decide after the browser answers. An empty list is still a result the person can read. */
export function noticeResult(input: { permission: NoticePermission; alertCount: number; shown: boolean }): NoticeResult {
  if (input.permission !== 'granted') return 'denied';
  if (input.alertCount === 0) return 'empty';
  if (!input.shown) return 'failed';
  return 'show';
}
