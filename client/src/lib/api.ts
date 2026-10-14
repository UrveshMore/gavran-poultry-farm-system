import { withServer } from './serverAddress';
import type { PublicUser } from './types';

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: { fields?: Record<string, string> };

  constructor(status: number, code: string, message: string, details?: { fields?: Record<string, string> }) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

type Options = { method?: string; json?: unknown; form?: FormData; retry?: boolean; csrfRetry?: boolean; idempotencyKey?: string };

let refreshPromise: Promise<boolean> | null = null;

function readCookie(name: string): string | null {
  for (const part of document.cookie.split('; ')) {
    if (part.startsWith(`${name}=`)) return decodeURIComponent(part.slice(name.length + 1));
  }
  return null;
}

async function csrfToken(): Promise<string> {
  const existing = readCookie('gavran_csrf');
  if (existing) return existing;
  const res = await fetch(withServer('/api/v1/auth/csrf'), { credentials: 'include' });
  const body = (await res.json()) as { data?: { csrfToken?: string } };
  if (!body.data?.csrfToken) throw new ApiError(res.status, 'CSRF_INVALID', 'Missing CSRF token.');
  return body.data.csrfToken;
}

async function refreshSession(): Promise<boolean> {
  const res = await fetch(withServer('/api/v1/auth/refresh'), {
    method: 'POST',
    credentials: 'include',
    headers: { 'X-CSRF-Token': await csrfToken() },
  });
  return res.ok;
}

function signInAgain(): void {
  if (typeof window === 'undefined') return;
  if (window.location.pathname.startsWith('/login')) return;
  window.location.assign('/login?expired=1');
}

export async function api<T>(path: string, options: Options = {}): Promise<T> {
  const method = options.method ?? 'GET';
  const headers = new Headers();
  if (options.json !== undefined) headers.set('content-type', 'application/json');
  if (options.idempotencyKey) headers.set('Idempotency-Key', options.idempotencyKey);
  let res: Response;
  try {
    if (method !== 'GET' && method !== 'HEAD') headers.set('X-CSRF-Token', await csrfToken());
    res = await fetch(withServer(path), {
      method,
      headers,
      credentials: 'include',
      body: options.form ?? (options.json !== undefined ? JSON.stringify(options.json) : undefined),
    });
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(0, 'NETWORK', 'The computer did not answer.');
  }
  if (res.status === 403 && !options.csrfRetry && method !== 'GET' && method !== 'HEAD') {
    document.cookie = 'gavran_csrf=; Max-Age=0; path=/';
    return api<T>(path, { ...options, csrfRetry: true });
  }
  if (
    res.status === 401 &&
    !options.retry &&
    !path.startsWith('/api/v1/auth/login') &&
    !path.startsWith('/api/v1/auth/register') &&
    !path.startsWith('/api/v1/auth/refresh')
  ) {
    refreshPromise ??= refreshSession().finally(() => {
      refreshPromise = null;
    });
    if (await refreshPromise) return api<T>(path, { ...options, retry: true });
    signInAgain();
    throw new ApiError(401, 'SESSION', 'Please sign in again');
  }
  const body = (await res.json().catch(() => null)) as {
    ok?: boolean;
    data?: T;
    error?: { code?: string; message?: string; details?: { fields?: Record<string, string> } };
  } | null;
  if (!res.ok || !body?.ok) {
    throw new ApiError(
      res.status,
      body?.error?.code ?? 'INTERNAL',
      body?.error?.message ?? 'Request failed',
      body?.error?.details,
    );
  }
  return body.data as T;
}

export function errorKey(error: unknown): string | null {
  if (!(error instanceof ApiError)) return null;
  const keys: Record<string, string> = {
    AUTH_INVALID_CREDENTIALS: 'auth.invalid',
    ACCOUNT_DEACTIVATED: 'auth.deactivated',
    RATE_LIMITED: 'auth.rateLimited',
    BOOTSTRAP_CLOSED: 'auth.bootstrapClosed',
    LAST_OWNER: 'people.lastOwner',
    DUPLICATE_CODE: 'farm.duplicateCode',
    VERSION_CONFLICT: 'farm.conflict',
    CAPACITY_EXCEEDED: 'batches.capacity',
    INSUFFICIENT_BIRDS: 'batches.insufficient',
    BATCH_CLOSED: 'batches.closedError',
    SHED_INACTIVE: 'batches.inactiveShed',
    BIRDS_REMAIN: 'batches.birdsRemain',
    INCUBATOR_OUT: 'incubation.outOfService',
    INCUBATOR_CAPACITY: 'incubation.capacity',
    EGGS_ALREADY_SET: 'hatch.tooMany',
    INSUFFICIENT_STOCK: 'stock.insufficient',
    ENTRY_UNAPPROVED: 'health.unapproved',
    INVOICE_POSTING_DISABLED: 'sales.invoiceOff',
    ALREADY_REVERSED: 'expenses.alreadyReversed',
    TRAINING_REQUIRED: 'workforce.required',
    TRAINING_ALREADY_DONE: 'workforce.alreadyDone',
    FILE_TOO_LARGE: 'documents.tooLarge',
    PAYLOAD_TOO_LARGE: 'documents.tooLarge',
    SAATHI_KEY_INVALID: 'saathi.keyInvalid',
    SESSION: 'auth.signInAgain',
    NETWORK: 'common.network',
    FORBIDDEN: 'common.permissionDenied',
  };
  return keys[error.code] ?? null;
}

export async function fetchMe(): Promise<PublicUser> {
  return api<PublicUser>('/api/v1/auth/me');
}
