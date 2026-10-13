import { BarChart3, Bird, ClipboardList, Egg, Feather, GraduationCap, Home, ListTodo, LogOut, Receipt, Shield, ShieldAlert, ShoppingBasket, Stethoscope, Thermometer, Users, Warehouse, Wheat } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';
import { useQueryClient } from '@tanstack/react-query';
import { LanguageSwitcher } from './LanguageSwitcher';
import { Logo } from './ui';

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-semibold ${isActive ? 'bg-grove text-paper' : 'text-ink hover:bg-paper-deep'}`;

export function AppShell() {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [online, setOnline] = useState(navigator.onLine);
  const farmMatch = location.pathname.match(/^\/farms\/([^/]+)/);
  const farmId = farmMatch && farmMatch[1] !== 'new' ? farmMatch[1] : undefined;

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
        { to: `/farms/${farmId}`, label: t('nav.farm'), icon: Home, end: true },
        { to: `/farms/${farmId}/sheds`, label: t('nav.sheds'), icon: Warehouse, end: false },
        { to: `/farms/${farmId}/batches`, label: t('nav.batches'), icon: Bird, end: false },
        { to: `/farms/${farmId}/eggs`, label: t('nav.eggs'), icon: Egg, end: false },
        { to: `/farms/${farmId}/incubators`, label: t('nav.incubators'), icon: Thermometer, end: false },
        { to: `/farms/${farmId}/incubation`, label: t('nav.incubation'), icon: Feather, end: false },
        { to: `/farms/${farmId}/tasks`, label: t('nav.tasks'), icon: ListTodo, end: false },
        { to: `/farms/${farmId}/workforce`, label: t('nav.workforce'), icon: GraduationCap, end: false },
        { to: `/farms/${farmId}/stock`, label: t('nav.stock'), icon: Wheat, end: false },
        { to: `/farms/${farmId}/health`, label: t('nav.health'), icon: Stethoscope, end: false },
        { to: `/farms/${farmId}/losses`, label: t('nav.losses'), icon: ShieldAlert, end: false },
        { to: `/farms/${farmId}/sales`, label: t('nav.sales'), icon: ShoppingBasket, end: false },
        { to: `/farms/${farmId}/expenses`, label: t('nav.expenses'), icon: Receipt, end: false },
        { to: `/farms/${farmId}/reports`, label: t('nav.reports'), icon: BarChart3, end: false },
        { to: `/farms/${farmId}/safeguards`, label: t('nav.safeguards'), icon: Shield, end: false },
        { to: `/farms/${farmId}/people`, label: t('nav.people'), icon: Users, end: false },
        { to: `/farms/${farmId}/activity`, label: t('nav.activity'), icon: ClipboardList, end: false },
      ]
    : [{ to: '/', label: t('nav.home'), icon: Home, end: true }];

  return (
    <div className="min-h-dvh md:grid md:grid-cols-[15.5rem_1fr]">
      <a className="sr-only" href="#content">
        {t('app.skipToContent')}
      </a>
      <aside className="hidden border-r border-line bg-grove text-paper md:flex md:flex-col md:gap-6 md:p-5">
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
          <p role="status" className="bg-clay px-4 py-2 text-sm font-semibold text-white">
            {t('shell.offline')}
          </p>
        ) : null}
        <main id="content" className="mx-auto grid w-full max-w-3xl gap-4 px-4 pb-28 pt-5 md:pb-10">
          <Outlet />
        </main>
      </div>
      {farmId ? (
        <nav className="fixed inset-x-0 bottom-0 z-20 flex overflow-x-auto border-t border-line bg-white/95 pb-[env(safe-area-inset-bottom)] md:hidden">
          {items.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => `flex min-h-14 min-w-[4.5rem] flex-1 flex-col items-center justify-center gap-1 px-1 text-xs font-semibold ${isActive ? 'text-grove' : 'text-ink-soft'}`}>
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
      <span className={compact ? 'font-display text-xl font-semibold md:hidden' : 'font-display text-2xl font-semibold'}>{t('app.name')}</span>
    </NavLink>
  );
}
