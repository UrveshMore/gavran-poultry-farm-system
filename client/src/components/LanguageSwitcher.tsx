import { LOCALES, type Locale } from '@gavran/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api';

const NAMES: Record<Locale, string> = { en: 'English', hi: 'हिन्दी', mr: 'मराठी' };

export function LanguageSwitcher() {
  const { i18n, t } = useTranslation();
  const queryClient = useQueryClient();
  const current: Locale = i18n.language === 'hi' || i18n.language === 'mr' ? i18n.language : 'en';

  async function onChange(locale: Locale) {
    localStorage.setItem('gavran.locale', locale);
    await i18n.changeLanguage(locale);
    try {
      await api('/api/v1/auth/me', { method: 'PATCH', json: { preferredLocale: locale } });
      await queryClient.invalidateQueries({ queryKey: ['me'] });
    } catch {
      // The login screen has no account yet.
    }
  }

  return (
    <label className="grid gap-1 text-sm font-semibold">
      <span className="sr-only">{t('lang.label')}</span>
      <select
        className="min-h-11 rounded-xl border border-line bg-white px-3"
        value={current}
        data-tour="language"
        aria-label={t('lang.label')}
        onChange={(event) => {
          const value = event.target.value;
          if (value === 'en' || value === 'hi' || value === 'mr') void onChange(value);
        }}
      >
        {LOCALES.map((locale) => (
          <option key={locale} value={locale}>
            {NAMES[locale]}
          </option>
        ))}
      </select>
      {current !== 'en' ? (
        <p data-provisional="true" className="max-w-56 text-xs font-semibold text-ink-soft">
          {t('lang.provisional')}
        </p>
      ) : null}
    </label>
  );
}
