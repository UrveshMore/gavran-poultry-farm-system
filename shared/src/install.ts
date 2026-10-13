export type InstallSurface = 'installed' | 'prompt' | 'ios' | 'hidden';

export function isIosUserAgent(userAgent: string): boolean {
  return /iPad|iPhone|iPod/.test(userAgent);
}

/** The browser decides when an install prompt exists. This only picks which hint to show. */
export function installSurface(input: { standalone: boolean; promptReady: boolean; ios: boolean }): InstallSurface {
  if (input.standalone) return 'installed';
  if (input.promptReady) return 'prompt';
  if (input.ios) return 'ios';
  return 'hidden';
}
