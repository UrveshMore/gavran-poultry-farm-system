import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, Bird, ChevronLeft, Egg, Ellipsis, Home, Menu, Thermometer } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
// flow-3: Gavran Saathi, the old group menu, and the page tour stay in the repo and are not shown.
// import { SaathiDock } from '@/components/SaathiDock';
// import { PageExplain } from '@/components/Tour';
// import { schedulePhoneAlerts } from '@/lib/phoneAlerts';
import { api } from '@/lib/api';
import { flushQueue, subscribeQueue, waitingCount } from '@/lib/offlineQueue';
import { isNativeApp } from '@/lib/serverAddress';
import { InstallPrompt } from './InstallPrompt';
import { LanguageSwitcher } from './LanguageSwitcher';
import { flowNav } from '@/pages/FlowPages';

type BellBoard = {
  home: { todayMedicine: { itemName: string; given: boolean; batchNumber: number; amountText: string }[] };
};

const mainNav = [
  { id: 'home', icon: Home },
  { id: 'incubator', icon: Thermometer },
  { id: 'batch', icon: Bird },
  { id: 'eggs', icon: Egg },
] as const;

export function AppShell() {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [online, setOnline] = useState(navigator.onLine);
  const [waiting, setWaiting] = useState(0);
  const [more, setMore] = useState(false);
  const [bell, setBell] = useState(false);
  const farmMatch = location.pathname.match(/^\/farms\/([^/]+)/);
  const farmId = farmMatch && farmMatch[1] !== 'new' ? farmMatch[1] : undefined;

  useEffect(() => {
    const refresh = () => {
      void waitingCount().then(setWaiting);
    };
    refresh();
    const stop = subscribeQueue(refresh);
    const on = () => {
      setOnline(true);
      void flushQueue().finally(refresh);
    };
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    if (navigator.onLine) void flushQueue().finally(refresh);
    return () => {
      stop();
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  useEffect(() => {
    setMore(false);
    setBell(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!isNativeApp()) return;
    let remove: (() => void) | undefined;
    void import('@capacitor/app')
      .then(({ App }) => App.addListener('backButton', ({ canGoBack }) => {
        if (canGoBack) navigate(-1);
      }))
      .then((handle) => {
        remove = () => {
          void handle.remove();
        };
      })
      .catch(() => undefined);
    return () => remove?.();
  }, [navigate]);

  const due = useQuery({
    queryKey: ['flow', farmId],
    enabled: Boolean(farmId) && bell,
    queryFn: () => api<BellBoard>(`/api/v1/farms/${farmId}/flow`),
  });

  async function signOut() {
    try {
      await api('/api/v1/auth/logout', { method: 'POST' });
    } finally {
      queryClient.clear();
      navigate('/login');
    }
  }

  const moreItems = farmId
    ? flowNav.filter((item) => item.id === 'medicine' || item.id === 'feed' || item.id === 'birds' || item.id === 'hisaab')
    : [];
  const moreActive = moreItems.some((item) => location.pathname.endsWith(`/${item.path}`));

  return (
    <div className="min-h-dvh bg-paper">
      <a className="sr-only" href="#content">
        {t('app.skipToContent')}
      </a>
      <div className="relative mx-auto min-h-dvh w-full max-w-md">
        <header className="sticky top-0 z-20 flex items-center gap-2 bg-paper/95 px-3 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur">
          {showBack(location.pathname) ? (
            <button type="button" className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-ink" onClick={() => navigate(-1)} aria-label={t('shell.back')}>
              <ChevronLeft aria-hidden="true" size={22} />
            </button>
          ) : (
            <button type="button" className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-ink" onClick={() => setMore(true)} aria-label={t('flow.look.more')}>
              <Menu aria-hidden="true" size={22} />
            </button>
          )}
          <div className="min-w-0 flex-1 text-center">
            <div className="flex items-center justify-center gap-2">
              <Feather />
              <span className="font-display text-[1.65rem] font-semibold leading-none tracking-tight text-ink">{t('app.name')}</span>
            </div>
            <p className="mt-0.5 text-[11px] text-ink-soft">{t('flow.look.care')}</p>
          </div>
          <button type="button" className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-ink" onClick={() => setBell(true)} aria-label={t('flow.look.bellTitle')}>
            <Bell aria-hidden="true" size={20} />
          </button>
        </header>
        {!online || waiting > 0 ? (
          <p role="status" className="bg-gold px-4 py-2 text-sm font-semibold text-ink">
            {t('shell.waiting', { count: waiting })}
          </p>
        ) : null}
        <main id="content" className="grid gap-4 px-4 pb-32 pt-2">
          <Outlet />
        </main>
        {farmId ? (
          <nav className="fixed bottom-0 left-1/2 z-20 flex w-full max-w-md -translate-x-1/2 border-t border-line/80 bg-white px-1 pb-[env(safe-area-inset-bottom)]">
            {mainNav.map((item) => {
              const meta = flowNav.find((entry) => entry.id === item.id);
              const to = meta?.path ? `/farms/${farmId}/${meta.path}` : `/farms/${farmId}`;
              return (
                <NavLink
                  key={item.id}
                  to={to}
                  end={Boolean(meta?.end)}
                  className={({ isActive }) => `flex min-h-16 min-w-0 flex-1 flex-col items-center justify-center gap-1 px-1 text-[11px] font-semibold ${isActive ? 'text-grove' : 'text-ink-soft'}`}
                >
                  <item.icon aria-hidden="true" size={20} strokeWidth={1.75} />
                  {t(`flow.nav.${item.id}`)}
                </NavLink>
              );
            })}
            <button type="button" className={`flex min-h-16 min-w-0 flex-1 flex-col items-center justify-center gap-1 px-1 text-[11px] font-semibold ${moreActive || more ? 'text-grove' : 'text-ink-soft'}`} onClick={() => setMore(true)}>
              <Ellipsis aria-hidden="true" size={20} strokeWidth={1.75} />
              {t('flow.look.more')}
            </button>
          </nav>
        ) : null}
      </div>
      {more ? (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-ink/40" role="dialog">
          <div data-sheet="more" className="max-h-[80dvh] w-full max-w-md overflow-y-auto rounded-t-[1.75rem] bg-paper px-4 pb-8 pt-3">
            <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-line" />
            <p className="mb-3 font-display text-2xl font-semibold">{t('flow.look.more')}</p>
            <div className="grid gap-2">
              {moreItems.map((item) => (
                <NavLink key={item.id} to={`/farms/${farmId}/${item.path}`} className="flex min-h-12 items-center gap-3 rounded-2xl bg-white px-4 font-semibold text-ink shadow-[0_4px_16px_rgba(31,77,43,0.05)]">
                  <item.icon aria-hidden="true" size={18} />
                  {t(`flow.nav.${item.id}`)}
                </NavLink>
              ))}
              <NavLink to="/account" className="flex min-h-12 items-center rounded-2xl bg-white px-4 font-semibold text-ink shadow-[0_4px_16px_rgba(31,77,43,0.05)]">
                {t('nav.account')}
              </NavLink>
              <div className="rounded-2xl bg-white px-4 py-3 shadow-[0_4px_16px_rgba(31,77,43,0.05)]">
                <LanguageSwitcher />
              </div>
              <InstallPrompt />
              <button type="button" className="min-h-12 rounded-2xl bg-white px-4 text-left font-semibold text-ink shadow-[0_4px_16px_rgba(31,77,43,0.05)]" onClick={() => void signOut()}>
                {t('auth.signOut')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {bell ? (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-ink/40" role="dialog">
          <div data-sheet="bell" className="max-h-[80dvh] w-full max-w-md overflow-y-auto rounded-t-[1.75rem] bg-paper px-4 pb-8 pt-3">
            <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-line" />
            <div className="mb-3 flex items-center justify-between">
              <p className="font-display text-2xl font-semibold">{t('flow.look.bellTitle')}</p>
              <button type="button" className="min-h-11 px-3 text-sm font-semibold text-grove" onClick={() => setBell(false)}>
                {t('flow.action.cancel')}
              </button>
            </div>
            {due.isLoading ? <p className="text-sm text-ink-soft">{t('common.loading')}</p> : null}
            {(due.data?.home.todayMedicine.filter((row) => !row.given) ?? []).length === 0 && !due.isLoading ? <p className="text-sm text-ink-soft">{t('flow.look.bellEmpty')}</p> : null}
            <div className="grid gap-2">
              {due.data?.home.todayMedicine
                .filter((row) => !row.given)
                .map((row) => (
                  <div key={`${row.batchNumber}-${row.itemName}`} className="rounded-2xl bg-white px-4 py-3 shadow-[0_4px_16px_rgba(31,77,43,0.05)]">
                    <p className="font-semibold">{row.itemName}</p>
                    <p className="text-sm text-ink-soft">
                      {t('flow.home.batch', { n: row.batchNumber })} · {row.amountText}
                    </p>
                  </div>
                ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function showBack(pathname: string): boolean {
  const parts = pathname.split('/').filter(Boolean);
  if (parts[0] === 'account' || parts[0] === 'server') return true;
  return parts[0] === 'farms' && parts.length > 2;
}

function Feather() {
  return (
    <svg viewBox="0 0 32 32" className="h-7 w-7 text-grove" aria-hidden="true">
      <path fill="currentColor" d="M20.5 3c-4 3-7 8-8.2 13.2 1.6.3 3.2.8 4.6 1.6C18.6 12.2 22 7.2 26 4.2 24.4 3.4 22.5 3 20.5 3z" />
      <path fill="currentColor" d="M11.2 17.2C8 20.6 5.6 24.6 4.8 28.2c3.2-.2 6.4-1.4 9.2-3.4-1.2-2.4-2-5-2.8-7.6z" />
      <path fill="currentColor" d="M16.8 18.6c2.2 1.4 4.2 2.4 6.4 2.8-1.6 2.2-3.8 4-6.4 5.2-1.2-2.4-1.6-5.2 0-8z" opacity="0.85" />
    </svg>
  );
}
