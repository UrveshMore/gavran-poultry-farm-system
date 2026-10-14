import {
  Bell,
  Bird,
  CircleHelp,
  ClipboardList,
  CloudOff,
  Egg,
  Feather,
  FileText,
  FolderOpen,
  GitBranch,
  GraduationCap,
  Home,
  MessageCircle,
  ListTodo,
  NotebookPen,
  Package,
  Pill,
  Receipt,
  Search,
  Shield,
  ShieldAlert,
  ShoppingBasket,
  Stethoscope,
  Sun,
  Thermometer,
  Users,
  Warehouse,
  Wheat,
  type LucideIcon,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link, Navigate, useParams } from 'react-router-dom';
import { DashboardCards, type DashboardData } from '@/components/DashboardCards';
import { HomeTour, startHomeTour } from '@/components/Tour';
import { Alert, Card } from '@/components/ui';
import { api } from '@/lib/api';
import { GROUP_IDS, screensInGroup, visibleGroups, type GroupId, type ScreenId } from '@/lib/nav';
import { localToday } from '@/lib/today';
import type { FarmSummary, FarmTask } from '@/lib/types';

const groupIcons: Record<GroupId | 'help', LucideIcon> = {
  daily: Sun,
  birds: Bird,
  incubator: Thermometer,
  health: Stethoscope,
  feed: Wheat,
  money: ShoppingBasket,
  reports: ClipboardList,
  people: Users,
  settings: Warehouse,
  help: CircleHelp,
};

const screenIcons: Record<ScreenId, LucideIcon> = {
  today: Sun,
  saathi: MessageCircle,
  yard: NotebookPen,
  tasks: ListTodo,
  workforce: GraduationCap,
  notices: Bell,
  batches: Bird,
  eggs: Egg,
  losses: ShieldAlert,
  parentage: GitBranch,
  incubators: Thermometer,
  incubation: Feather,
  health: Stethoscope,
  medicines: Pill,
  stock: Wheat,
  sales: ShoppingBasket,
  expenses: Receipt,
  suppliers: Package,
  invoices: FileText,
  reports: ClipboardList,
  people: Users,
  profile: Home,
  sheds: Warehouse,
  documents: FolderOpen,
  schedules: ClipboardList,
  safeguards: Shield,
  offline: CloudOff,
  search: Search,
  activity: ClipboardList,
};

function Tile({ to, icon: Icon, title, body, tour }: { to: string; icon: LucideIcon; title: string; body: string; tour?: string }) {
  return (
    <Link
      to={to}
      data-tour={tour}
      className="flex min-h-28 flex-col justify-between rounded-2xl border border-line bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-grove active:translate-y-0"
    >
      <Icon aria-hidden="true" className="text-grove" size={32} />
      <span>
        <span className="mt-3 block text-lg font-semibold">{title}</span>
        <span className="mt-1 block text-sm text-ink-soft">{body}</span>
      </span>
    </Link>
  );
}

export function FarmHomePage() {
  const { farmId = '' } = useParams();
  const { t } = useTranslation();
  const farms = useQuery({ queryKey: ['farms'], queryFn: () => api<FarmSummary[]>('/api/v1/farms') });
  const farm = farms.data?.find((item) => item.id === farmId);
  const board = useQuery({
    queryKey: ['dashboard', farmId],
    queryFn: () => api<DashboardData>(`/api/v1/farms/${farmId}/dashboard`),
    enabled: Boolean(farmId),
  });
  if (farms.isLoading) return <p>{t('common.loading')}</p>;
  if (!farm) return <Alert>{t('farm.notFound')}</Alert>;
  const groups = visibleGroups(farm.permissions);
  return (
    <div className="grid gap-4">
      <HomeTour role={farm.role} />
      {board.data ? (
        <DashboardCards farmId={farmId} data={board.data} canRecord={Boolean(farm.permissions.includes('health.record'))} />
      ) : null}
      {board.isError ? <Alert>{t('common.errorGeneric')}</Alert> : null}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold">{farm.name}</h1>
          <p className="mt-1 text-ink-soft">{t('home.body')}</p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Link data-tour="saathi" to={`/farms/${farmId}/saathi`} className="min-h-11 rounded-xl bg-grove px-3 py-2 text-sm font-semibold text-white">
            {t('saathi.title')}
          </Link>
          <button type="button" className="min-h-11 rounded-xl px-3 text-sm font-semibold text-grove underline" onClick={() => startHomeTour(farm.role, t, false)}>
            {t('tour.replay')}
          </button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {groups.map((group) => {
          const screens = screensInGroup(group, farm.permissions);
          const only = screens[0];
          const target = screens.length === 1 && only ? `/farms/${farmId}/${only.path}` : `/farms/${farmId}/go/${group}`;
          const Icon = groupIcons[group];
          return <Tile key={group} to={target} icon={Icon} title={t(`nav.group.${group}`)} body={t(`nav.group.${group}Hint`)} tour={`group-${group}`} />;
        })}
        <Tile to={`/farms/${farmId}/help`} icon={CircleHelp} title={t('nav.group.help')} body={t('nav.group.helpHint')} tour="group-help" />
      </div>
    </div>
  );
}

export function GroupPage() {
  const { farmId = '', groupId = '' } = useParams();
  const { t } = useTranslation();
  const farms = useQuery({ queryKey: ['farms'], queryFn: () => api<FarmSummary[]>('/api/v1/farms') });
  const farm = farms.data?.find((item) => item.id === farmId);
  if (!GROUP_IDS.includes(groupId as GroupId)) return <Navigate to={`/farms/${farmId}`} replace />;
  const group = groupId as GroupId;
  if (farms.isLoading || !farm) return <p>{t('common.loading')}</p>;
  const screens = screensInGroup(group, farm.permissions);
  if (screens.length === 0) return <Navigate to={`/farms/${farmId}`} replace />;
  const only = screens[0];
  if (screens.length === 1 && only) return <Navigate to={`/farms/${farmId}/${only.path}`} replace />;
  return (
    <div className="grid gap-4">
      <div>
        <h1 className="font-display text-3xl font-semibold">{t(`nav.group.${group}`)}</h1>
        <p className="mt-1 text-ink-soft">{t(`nav.group.${group}Hint`)}</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {screens.map((screen) => {
          const Icon = screenIcons[screen.id];
          return <Tile key={screen.id} to={`/farms/${farmId}/${screen.path}`} icon={Icon} title={t(`nav.screen.${screen.id}`)} body={t(`help.${screen.id}.why`)} />;
        })}
      </div>
    </div>
  );
}

export function TodayPage() {
  const { farmId = '' } = useParams();
  const { t } = useTranslation();
  const today = localToday();
  const farms = useQuery({ queryKey: ['farms'], queryFn: () => api<FarmSummary[]>('/api/v1/farms') });
  const farm = farms.data?.find((item) => item.id === farmId);
  const canTasks = Boolean(farm?.permissions.includes('task.read'));
  const tasks = useQuery({
    queryKey: ['tasks', farmId],
    queryFn: () => api<FarmTask[]>(`/api/v1/farms/${farmId}/tasks`),
    enabled: canTasks,
  });
  const open = (tasks.data ?? []).filter((task) => task.status === 'open' && task.dueOn <= today);
  const links = [
    farm?.permissions.includes('egg.read') ? { to: 'eggs', label: t('nav.screen.eggs') } : null,
    farm?.permissions.includes('loss.read') ? { to: 'losses', label: t('nav.screen.losses') } : null,
    farm?.permissions.includes('stock.read') ? { to: 'stock', label: t('nav.screen.stock') } : null,
    farm?.permissions.includes('attendance.read') ? { to: 'workforce', label: t('nav.screen.workforce') } : null,
    farm?.permissions.includes('health.read') ? { to: 'health', label: t('nav.screen.health') } : null,
    farm?.permissions.includes('yard.read') ? { to: 'yard', label: t('nav.screen.yard') } : null,
  ].filter((item): item is { to: string; label: string } => item !== null);
  return (
    <div className="grid gap-4">
      <div>
        <h1 className="font-display text-3xl font-semibold">{t('today.title')}</h1>
        <p className="mt-1 text-ink-soft">{t('today.body', { date: today })}</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {links.map((link) => (
          <Link key={link.to} to={`/farms/${farmId}/${link.to}`} className="flex min-h-20 items-center rounded-2xl border border-line bg-white px-4 text-lg font-semibold">
            {link.label}
          </Link>
        ))}
      </div>
      {canTasks ? (
        <Card>
          <h2 className="font-display text-2xl">{t('today.jobs')}</h2>
          {tasks.isLoading ? <p className="mt-2">{t('common.loading')}</p> : null}
          {open.length === 0 && !tasks.isLoading ? <p className="mt-2 text-ink-soft">{t('today.noJobs')}</p> : null}
          <ul className="mt-3 grid gap-2">
            {open.map((task) => (
              <li key={task.id}>
                <Link className="font-semibold text-grove underline" to={`/farms/${farmId}/tasks/${task.id}`}>
                  {task.title}
                </Link>
                <span className="ml-2 text-sm text-ink-soft">{task.dueOn}</span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}

const HELP_IDS: Array<ScreenId | 'home'> = [
  'home',
  'today',
  'saathi',
  'yard',
  'tasks',
  'workforce',
  'notices',
  'batches',
  'eggs',
  'losses',
  'parentage',
  'incubators',
  'incubation',
  'health',
  'medicines',
  'stock',
  'sales',
  'expenses',
  'suppliers',
  'invoices',
  'reports',
  'people',
  'profile',
  'sheds',
  'documents',
  'schedules',
  'safeguards',
  'offline',
  'search',
  'activity',
];

export function HelpPage() {
  const { farmId = '' } = useParams();
  const { t } = useTranslation();
  const farms = useQuery({ queryKey: ['farms'], queryFn: () => api<FarmSummary[]>('/api/v1/farms') });
  const farm = farms.data?.find((item) => item.id === farmId);
  return (
    <div className="grid gap-4">
      <div>
        <h1 className="font-display text-3xl font-semibold">{t('help.title')}</h1>
        <p className="mt-1 text-ink-soft">{t('help.body')}</p>
      </div>
      {farm ? (
        <button type="button" className="min-h-11 justify-self-start rounded-xl bg-grove px-4 font-semibold text-white" onClick={() => startHomeTour(farm.role, t, false)}>
          {t('tour.replay')}
        </button>
      ) : null}
      {HELP_IDS.map((id) => (
        <Card key={id}>
          <h2 id={id} className="font-display text-2xl">{t(`help.${id}.name`)}</h2>
          <img className="mt-3 w-full rounded-xl border border-line" src={`/guide/${id}.png`} alt="" onError={(event) => { event.currentTarget.style.display = 'none'; }} />
          <dl className="mt-3 grid gap-2 text-sm">
            <div>
              <dt className="font-semibold">{t('help.what')}</dt>
              <dd>{t(`help.${id}.what`)}</dd>
            </div>
            <div>
              <dt className="font-semibold">{t('help.where')}</dt>
              <dd>{t(`help.${id}.where`)}</dd>
            </div>
            <div>
              <dt className="font-semibold">{t('help.why')}</dt>
              <dd>{t(`help.${id}.why`)}</dd>
            </div>
            <div>
              <dt className="font-semibold">{t('help.how')}</dt>
              <dd className="whitespace-pre-wrap">{t(`help.${id}.how`)}</dd>
            </div>
          </dl>
        </Card>
      ))}
    </div>
  );
}
