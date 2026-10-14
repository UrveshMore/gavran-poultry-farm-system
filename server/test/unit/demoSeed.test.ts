import { describe, expect, it } from 'vitest';
import { assertDemoSeedAllowed, DEMO_ADMIN_PASSWORD } from '../../src/demo/seedDemo.js';

describe('demo seed guard', () => {
  it('refuses to run when NODE_ENV is production', () => {
    expect(() => assertDemoSeedAllowed('production')).toThrow(/production/);
  });

  it('allows a local development run', () => {
    expect(() => assertDemoSeedAllowed('development')).not.toThrow();
  });

  it('keeps the short demo password out of the normal sign-up rule', () => {
    expect(DEMO_ADMIN_PASSWORD.length).toBeLessThan(10);
  });
});
