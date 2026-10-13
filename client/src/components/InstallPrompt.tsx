import { installSurface, isIosUserAgent } from '@gavran/shared';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

export function InstallPrompt() {
  const { t } = useTranslation();
  const promptRef = useRef<BeforeInstallPromptEvent | null>(null);
  const [promptReady, setPromptReady] = useState(false);
  const [standalone, setStandalone] = useState(false);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    const media = window.matchMedia('(display-mode: standalone)');
    const sync = () => {
      const nav = navigator as Navigator & { standalone?: boolean };
      setStandalone(media.matches || nav.standalone === true);
    };
    sync();
    setIos(isIosUserAgent(navigator.userAgent));
    media.addEventListener('change', sync);
    const onPrompt = (event: Event) => {
      event.preventDefault();
      promptRef.current = event as BeforeInstallPromptEvent;
      setPromptReady(true);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    return () => {
      media.removeEventListener('change', sync);
      window.removeEventListener('beforeinstallprompt', onPrompt);
    };
  }, []);

  const surface = installSurface({ standalone, promptReady, ios });
  if (surface === 'prompt') {
    return (
      <button
        type="button"
        data-install="prompt"
        className="min-h-11 rounded-xl bg-grove px-3 text-sm font-semibold text-paper"
        onClick={() => {
          void promptRef.current?.prompt();
        }}
      >
        {t('install.action')}
      </button>
    );
  }
  if (surface === 'ios') {
    return (
      <p data-install="ios" className="max-w-48 text-xs font-semibold text-ink-soft">
        {t('install.ios')}
      </p>
    );
  }
  return null;
}
