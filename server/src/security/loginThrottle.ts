import { AppError } from '../http/errors.js';

type Bucket = { failures: number; resetAt: number };

export function createLoginThrottle(max: number, windowMs: number) {
  const buckets = new Map<string, Bucket>();

  function current(key: string): Bucket {
    const now = Date.now();
    const existing = buckets.get(key);
    if (!existing || existing.resetAt <= now) {
      const fresh = { failures: 0, resetAt: now + windowMs };
      buckets.set(key, fresh);
      return fresh;
    }
    return existing;
  }

  return {
    assert(key: string): void {
      if (current(key).failures >= max) {
        throw new AppError(429, 'RATE_LIMITED', 'Too many sign-in attempts. Try again later.');
      }
    },
    fail(key: string): void {
      current(key).failures += 1;
    },
    reset(): void {
      buckets.clear();
    },
  };
}
