import { driver, type DriveStep } from 'driver.js';
import 'driver.js/dist/driver.css';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

type Translate = (key: string) => string;

const HOME_KEY = 'gavran.tour.home';

function buttons(t: Translate) {
  return {
    nextBtnText: t('tour.next'),
    prevBtnText: t('tour.back'),
    doneBtnText: t('tour.done'),
    showProgress: true,
    overlayOpacity: 0.55,
    stagePadding: 8,
    popoverClass: 'gavran-tour',
  };
}

export function startHomeTour(role: string, t: Translate, markSeen = true) {
  const welcome =
    role === 'worker' ? 'tour.welcome.worker' : role === 'manager' ? 'tour.welcome.manager' : 'tour.welcome.owner';
  const steps: DriveStep[] = [
    { popover: { title: t('tour.welcomeTitle'), description: t(welcome) } },
    ...(['daily', 'birds', 'incubator', 'health', 'feed', 'money', 'reports', 'people', 'settings'] as const).map((group) => ({
      element: `[data-tour="group-${group}"]`,
      popover: { title: t(`nav.group.${group}`), description: t(`tour.group.${group}`) },
    })),
    { element: '[data-tour="group-help"]', popover: { title: t('nav.group.help'), description: t('tour.group.help') } },
    { element: '[data-tour="language"]', popover: { title: t('tour.languageTitle'), description: t('tour.languageBody') } },
  ];
  const tour = driver({
    ...buttons(t),
    steps,
    skipMissingElement: true,
    onDestroyed: () => {
      if (markSeen) localStorage.setItem(`${HOME_KEY}.${role}`, '1');
    },
  });
  tour.drive();
}

export function startScreenTour(screen: 'eggs' | 'incubators' | 'batches' | 'health', t: Translate, markSeen = true) {
  const steps: DriveStep[] = [
    { element: '[data-tour="screen-title"]', popover: { title: t(`${screen}.title`), description: t(`tour.screen.${screen}.title`) } },
    { element: '[data-tour="screen-body"]', popover: { title: t('tour.whyTitle'), description: t(`tour.screen.${screen}.why`) } },
    { element: '[data-tour="screen-action"]', popover: { title: t('tour.tapTitle'), description: t(`tour.screen.${screen}.tap`) } },
  ];
  const tour = driver({
    ...buttons(t),
    steps,
    skipMissingElement: true,
    onDestroyed: () => {
      if (markSeen) localStorage.setItem(`gavran.tour.screen.${screen}`, '1');
    },
  });
  tour.drive();
}

export function HomeTour({ role }: { role: string }) {
  const { t } = useTranslation();
  useEffect(() => {
    if (localStorage.getItem(`${HOME_KEY}.${role}`)) return;
    const timer = window.setTimeout(() => startHomeTour(role, t), 400);
    return () => window.clearTimeout(timer);
  }, [role, t]);
  return null;
}

export function ScreenTour({ screen }: { screen: 'eggs' | 'incubators' | 'batches' | 'health' }) {
  const { t } = useTranslation();
  useEffect(() => {
    if (localStorage.getItem(`gavran.tour.screen.${screen}`)) return;
    const timer = window.setTimeout(() => startScreenTour(screen, t), 500);
    return () => window.clearTimeout(timer);
  }, [screen, t]);
  return (
    <button type="button" className="min-h-11 rounded-xl px-3 text-sm font-semibold text-grove underline" onClick={() => startScreenTour(screen, t, false)}>
      {t('tour.replayScreen')}
    </button>
  );
}
