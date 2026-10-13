import { likePattern } from '@gavran/shared';
import { describe, expect, it } from 'vitest';

describe('search pattern', () => {
  it('escapes wildcards and refuses a one-character query', () => {
    expect(likePattern('a')).toBeNull();
    expect(likePattern('  %  ')).toBeNull();
    expect(likePattern('A%')).toBe('%A!%%');
    expect(likePattern('a_b')).toBe('%a!_b%');
    expect(likePattern('100%')).toBe('%100!%%');
  });
});
