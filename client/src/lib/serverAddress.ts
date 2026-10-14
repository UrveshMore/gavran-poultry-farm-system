import { Capacitor } from '@capacitor/core';

const KEY = 'gavran.server';

export function isNativeApp(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

export function savedServer(): string {
  if (!isNativeApp()) return '';
  return (localStorage.getItem(KEY) ?? '').replace(/\/+$/, '');
}

export function saveServer(address: string) {
  const trimmed = address.trim().replace(/\/+$/, '');
  localStorage.setItem(KEY, trimmed);
}

export function withServer(path: string): string {
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  const base = savedServer();
  return base ? `${base}${path}` : path;
}
