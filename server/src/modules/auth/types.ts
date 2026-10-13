import type { Locale } from '@gavran/shared';

export type PublicUser = {
  id: string;
  email: string;
  displayName: string;
  preferredLocale: Locale;
  platformRole: 'system_administrator' | null;
  status: 'active' | 'deactivated';
};

export type AuthUser = PublicUser & { sessionId: string };

export type UserRecord = PublicUser & { passwordHash: string };
