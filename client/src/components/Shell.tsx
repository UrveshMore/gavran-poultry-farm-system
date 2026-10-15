import { LogOut } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
// flow-3: Gavran Saathi, the old group menu, the bell, and the page tour stay in the repo and are not shown.
// import { SaathiDock } from '@/components/SaathiDock';
// import { PageExplain } from '@/components/Tour';
// import { schedulePhoneAlerts } from '@/lib/phoneAlerts';
import { api } from '@/lib/api';
import { flushQueue, subscribeQueue, waitingCount } from '@/lib/offlineQueue';
import { isNativeApp } from '@/lib/serverAddress';
import { useQueryClient } from '@tanstack/react-query';
import { InstallPrompt } from './InstallPrompt';
import { LanguageSwitcher } from './LanguageSwitcher';
import { Logo } from './ui';
import { flowNav } from '@/pages/FlowPages';

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-semibold ${isActive ? 'bg-paper text-ink' : 'text-nav-text hover:bg-white/10'}`;

export function AppShell() {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [online, setOnline] = useState(navigator.onLine);
  const [waiting, setWaiting] = useState(0);
  const farmMatch = location.pathname.match(/^\/farms\/([^/]+)/);
  const farmId = farmMatch && farmMatch[1] !== 'new' ? farmMatch[1] : undefined;
  // flow-3: the old dashboard fetch and phone alarms stay commented so the eight tabs are the menu.
  // const groups = farm ? visibleGroups(farm.permissions) : [];

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

  async function signOut() {
    try {
      await api('/api/v1/auth/logout', { method: 'POST' });
    } finally {
      queryClient.clear();
      navigate('/login');
    }
  }

  const items = farmId
    ? flowNav.map((item) => ({
        to: item.path ? `/farms/${farmId}/${item.path}` : `/farms/${farmId}`,
        label: t(`flow.nav.${item.id}`),
        icon: item.icon,
        end: Boolean(item.end),
      }))
    : [{ to: '/', label: t('flow.nav.home'), icon: flowNav[0]!.icon, end: true }];
  const mobile = items;

  return (
    <div className="min-h-dvh md:grid md:grid-cols-[16rem_1fr]">
      <a className="sr-only" href="#content">
        {t('app.skipToContent')}
      </a>
      <aside className="hidden overflow-y-auto border-r border-line bg-nav text-nav-text md:flex md:flex-col md:gap-6 md:p-5">
        <Brand />
        <nav className="grid gap-1">
          {items.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className={linkClass}>
              <item.icon aria-hidden="true" size={18} />
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <div className="min-w-0">
        <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-line bg-paper/95 px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur">
          <div className="flex min-w-0 items-center gap-2">
            {showBack(location.pathname) ? (
              <button type="button" className="min-h-11 rounded-xl px-3 text-sm font-semibold text-grove" onClick={() => navigate(-1)}>
                {t('shell.back')}
              </button>
            ) : null}
            <Brand compact />
          </div>
          <div className="flex items-center gap-2">
            {/* flow-3: the alert bell stays off the header.
            {farmId ? (
              <NavLink to={`/farms/${farmId}#alerts`} className="relative inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl hover:bg-paper-deep" aria-label={t('alerts.bell')}>
                <Bell aria-hidden="true" size={20} />
              </NavLink>
            ) : null}
            */}
            <InstallPrompt />
            <LanguageSwitcher />
            <NavLink to="/account" className="min-h-11 rounded-xl px-3 py-2 text-sm font-semibold hover:bg-paper-deep">
              {t('nav.account')}
            </NavLink>
            <button type="button" className="inline-flex min-h-11 items-center gap-1 rounded-xl px-3 text-sm font-semibold" onClick={() => void signOut()}>
              <LogOut aria-hidden="true" size={18} />
              <span className="hidden sm:inline">{t('auth.signOut')}</span>
            </button>
          </div>
        </header>
        {!online || waiting > 0 ? (
          <p role="status" className="bg-clay px-4 py-2 text-sm font-semibold text-ink">
            {t('shell.waiting', { count: waiting })}
          </p>
        ) : null}
        <main id="content" className="mx-auto grid w-full max-w-3xl gap-4 px-4 pb-28 pt-5 md:max-w-5xl md:pb-10">
          {/* flow-3: page tour button hidden. {farmId ? <PageExplain /> : null} */}
          <Outlet />
        </main>
      </div>
      {/* flow-3: voice and chat dock hidden. {farmId ? <SaathiDock farmId={farmId} /> : null} */}
      {farmId ? (
        <nav className="fixed inset-x-0 bottom-0 z-20 flex gap-1 overflow-x-auto border-t border-line bg-white px-1 pb-[env(safe-area-inset-bottom)] md:hidden">
          {mobile.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => `flex min-h-14 min-w-16 flex-col items-center justify-center gap-1 px-2 text-xs font-semibold ${isActive ? 'text-grove' : 'text-ink-soft'}`}>
              <item.icon aria-hidden="true" size={18} />
              {item.label}
            </NavLink>
          ))}
        </nav>
      ) : null}
    </div>
  );
}

function showBack(pathname: string): boolean {
  const parts = pathname.split('/').filter(Boolean);
  if (parts[0] === 'account' || parts[0] === 'server') return true;
  return parts[0] === 'farms' && parts.length > 2;
}

function Brand({ compact = false }: { compact?: boolean }) {
  const { t } = useTranslation();
  return (
    <NavLink to="/" className="flex min-h-11 items-center gap-2">
      <Logo className={compact ? 'h-9 w-9 md:hidden' : 'h-11 w-11'} />
      <span className={compact ? 'font-display text-xl font-semibold text-ink md:hidden' : 'font-display text-2xl font-semibold text-nav-text'}>{t('app.name')}</span>
    </NavLink>
  );
}
