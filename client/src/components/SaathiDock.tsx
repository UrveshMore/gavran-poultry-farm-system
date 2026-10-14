import { MessageCircle } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SaathiChat } from '@/pages/SaathiPage';

export function SaathiDock({ farmId }: { farmId: string }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  return (
    <>
      {open ? (
        <div className="fixed inset-x-3 bottom-24 z-30 max-h-[70dvh] overflow-auto rounded-3xl border border-line bg-paper p-3 shadow-2xl md:inset-x-auto md:bottom-24 md:right-6 md:w-[28rem]">
          <div className="mb-2 flex items-center justify-between">
            <p className="font-display text-xl font-semibold">{t('saathi.title')}</p>
            <button type="button" className="min-h-11 rounded-xl px-3 text-sm font-semibold" onClick={() => setOpen(false)}>
              {t('saathi.close')}
            </button>
          </div>
          <SaathiChat farmId={farmId} compact />
        </div>
      ) : null}
      <button
        type="button"
        className="fixed bottom-20 right-4 z-30 flex h-16 w-16 items-center justify-center rounded-full bg-grove text-3xl text-white shadow-lg md:bottom-6"
        aria-label={t('saathi.title')}
        onClick={() => setOpen((value) => !value)}
      >
        <MessageCircle aria-hidden="true" size={28} />
      </button>
    </>
  );
}
