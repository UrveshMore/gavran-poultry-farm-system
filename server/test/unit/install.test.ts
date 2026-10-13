import { installSurface, isIosUserAgent } from '@gavran/shared';
import { describe, expect, it } from 'vitest';

describe('install surface', () => {
  it('shows a prompt only when the browser offers one and the app is not already installed', () => {
    expect(installSurface({ standalone: true, promptReady: true, ios: true })).toBe('installed');
    expect(installSurface({ standalone: false, promptReady: true, ios: false })).toBe('prompt');
    expect(installSurface({ standalone: false, promptReady: false, ios: true })).toBe('ios');
    expect(installSurface({ standalone: false, promptReady: false, ios: false })).toBe('hidden');
    expect(isIosUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)')).toBe(true);
    expect(isIosUserAgent('Mozilla/5.0 (X11; Linux x86_64) Chrome/120.0.0.0')).toBe(false);
  });
});