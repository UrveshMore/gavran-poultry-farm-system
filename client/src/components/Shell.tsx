import {
  Bird,
  CircleHelp,
  ClipboardList,
  Home,
  LogOut,
  ShoppingBasket,
  Stethoscope,
  Sun,
  Thermometer,
  Users,
  Warehouse,
  Wheat,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';
import { useQuery } from '@tanstack/react-query';
import { useQueryClient } from '@tanstack/react-query';
import { InstallPrompt } from './InstallPrompt';
import { LanguageSwitcher } from './LanguageSwitcher';
import { Logo } from './ui';
import { visibleGroups, type GroupId } from '@/lib/nav';
import type { FarmSummary } from '@/lib/types';

const groupIcons: Record<GroupId, LucideIcon> = {
  daily: Sun,
  birds: Bird,
  incubator: Thermometer,
  health: Stethoscope,
  feed: Wheat,
  money: ShoppingBasket,
  reports: ClipboardList,
  people: Users,
  settings: Warehouse,
};

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-semibold ${isActive ? 'bg-paper text-ink' : 'text-nav-text hover:bg-white/10'}`;

export function AppShell() {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [online, setOnline] = useState(navigator.onLine);
  const farmMatch = location.pathname.match(/^\/farms\/([^/]+)/);
  const farmId = farmMatch && farmMatch[1] !== 'new' ? farmMatch[1] : undefined;
  const farms = useQuery({ queryKey: ['farms'], queryFn: () => api<FarmSummary[]>('/api/v1/farms'), enabled: Boolean(farmId) });
  const farm = farms.data?.find((item) => item.id === farmId);
  const groups = farm ? visibleGroups(farm.permissions) : [];

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  async function signOut() {
    try {
      await api('/api/v1/auth/logout', { method: 'POST' });
    } finally {
      queryClient.clear();
      navigate('/login');
    }
  }

  const items = farmId
    ? [
        { to: `/farms/${farmId}`, label: t('nav.home'), icon: Home, end: true },
        ...groups.map((group) => ({
          to: `/farms/${farmId}/go/${group}`,
          label: t(`nav.group.${group}`),
          icon: groupIcons[group],
          end: false,
        })),
        { to: `/farms/${farmId}/help`, label: t('nav.group.help'), icon: CircleHelp, end: false },
      ]
    : [{ to: '/', label: t('nav.home'), icon: Home, end: true }];

  const mobile = farmId
    ? [
        { to: `/farms/${farmId}`, label: t('nav.home'), icon: Home, end: true },
        { to: `/farms/${farmId}/today`, label: t('nav.screen.today'), icon: Sun, end: false },
        { to: `/farms/${farmId}/go/birds`, label: t('nav.group.birds'), icon: Bird, end: false },
        { to: `/farms/${farmId}/health`, label: t('nav.group.health'), icon: Stethoscope, end: false },
        { to: `/farms/${farmId}/help`, label: t('nav.group.help'), icon: CircleHelp, end: false },
      ]
    : [];

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
        <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-line bg-paper/95 px-4 py-3 backdrop-blur">
          <Brand compact />
          <div className="flex items-center gap-2">
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
        {!online ? (
          <p role="status" className="bg-clay px-4 py-2 text-sm font-semibold text-ink">
            {t('shell.offline')}
          </p>
        ) : null}
        <main id="content" className="mx-auto grid w-full max-w-3xl gap-4 px-4 pb-28 pt-5 md:max-w-5xl md:pb-10">
          <Outlet />
        </main>
      </div>
      {farmId ? (
        <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t border-line bg-white pb-[env(safe-area-inset-bottom)] md:hidden">
          {mobile.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => `flex min-h-14 flex-col items-center justify-center gap-1 px-1 text-xs font-semibold ${isActive ? 'text-grove' : 'text-ink-soft'}`}>
              <item.icon aria-hidden="true" size={18} />
              {item.label}
            </NavLink>
          ))}
        </nav>
      ) : null}
    </div>
  );
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
