import { Bell, Bird, Egg, Stethoscope, Wheat } from 'lucide-react';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Card } from '@/components/ui';

export type DashAlert = { code: 'care_overdue' | 'care_due' | 'low_stock' | 'task_overdue' | 'eggs_missing'; count: number; path: string };

export type DashCare = { id: string; title: string; dueOn: string };

export type DashboardData = {
  today: string;
  birds: {
    total: number;
    roosters: number | null;
    hens: number | null;
    sexMissing: number;
    flocks: Array<{
      id: string;
      code: string;
      liveCount: number;
      ageDays: number | null;
      sex: { roosters: number; hens: number; countedOn: string } | null;
      placements: Array<{ shedName: string; birdCount: number }>;
    }>;
    sheds: Array<{ shedName: string; birdCount: number }>;
  } | null;
  eggs: { today: number; recordedToday: boolean; days: Array<{ date: string; count: number }> } | null;
  incubation: {
    openSittings: number;
    sittings: Array<{ id: string; code: string; name: string | null; eggCount: number; daysToCandling: null; daysToHatch: null; lastCandledOn: string | null }>;
  } | null;
  tasks: { dueToday: number; overdue: number; items: Array<{ id: string; title: string; dueOn: string; overdue: boolean }> } | null;
  health: {
    notes: Array<{ id: string; observedOn: string; birdCount: number | null; notes: string; batchCode: string | null }>;
    losses: { notes: number; birds: number } | null;
    vaccines: { overdue: DashCare[]; dueToday: DashCare[]; upcoming: DashCare[] };
  } | null;
  stock: { low: Array<{ id: string; name: string; onHand: number; unitLabel: string }>; items: Array<{ id: string; name: string; onHand: number; unitLabel: string; belowReorder: boolean }> } | null;
  money: {
    sales: { status: string; amount: number | null; unitLabel: string | null } | null;
    expenses: Array<{ unitLabel: string; amount: number }> | null;
    pending: { status: string; billsExist?: boolean };
  } | null;
  attention: Array<{ code: string; count: number; path: string }>;
  alerts: DashAlert[];
};

function num(value: number | null, missing: string) {
  return value === null ? missing : String(value);
}

export function alertCount(alerts: DashAlert[]): number {
  return alerts.reduce((sum, row) => sum + row.count, 0);
}

export function DashboardCards({ farmId, data }: { farmId: string; data: DashboardData }) {
  const { t } = useTranslation();
  const notSet = t('dash.notSet');
  const care = [
    ...(data.health?.vaccines.overdue ?? []).map((row) => ({ ...row, when: 'overdue' as const })),
    ...(data.health?.vaccines.dueToday ?? []).map((row) => ({ ...row, when: 'today' as const })),
    ...(data.health?.vaccines.upcoming ?? []).map((row) => ({ ...row, when: 'soon' as const })),
  ];

  useEffect(() => {
    if (data.alerts.length === 0 || typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    const key = `gavran.alert.${farmId}.${data.today}`;
    if (localStorage.getItem(key)) return;
    const body = data.alerts.map((row) => t(`dash.alert.${row.code}`, { count: row.count })).join('. ');
    const show = async () => {
      const ready = await navigator.serviceWorker?.ready.catch(() => undefined);
      if (ready) await ready.showNotification(t('dash.title'), { body });
      else new Notification(t('dash.title'), { body });
      localStorage.setItem(key, '1');
    };
    void show();
  }, [data.alerts, data.today, farmId, t]);

  async function allowAlerts() {
    if (typeof Notification === 'undefined') return;
    await Notification.requestPermission();
  }

  return (
    <div className="grid gap-3">
      {data.alerts.length > 0 ? (
        <div id="alerts" className="grid gap-2" role="status">
          {data.alerts.map((row) => (
            <Link
              key={row.code}
              to={`/farms/${farmId}/${row.path}`}
              className={`rounded-2xl px-4 py-3 text-sm font-semibold ${row.code === 'care_overdue' || row.code === 'task_overdue' ? 'bg-clay text-ink' : 'bg-gold/50 text-ink'}`}
            >
              {t(`dash.alert.${row.code}`, { count: row.count })}
            </Link>
          ))}
        </div>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-2xl font-semibold">{t('dash.title')}</h2>
        {typeof Notification !== 'undefined' && Notification.permission !== 'granted' ? (
          <button type="button" className="min-h-11 rounded-xl px-3 text-sm font-semibold text-grove underline" onClick={() => void allowAlerts()}>
            {t('dash.allowAlerts')}
          </button>
        ) : null}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {data.birds ? (
          <Link to={`/farms/${farmId}/batches`} className="block">
            <Card>
              <Bird className="text-grove" aria-hidden="true" />
              <p className="text-sm text-ink-soft">{t('dash.birds')}</p>
              <p className="font-display text-4xl font-semibold">{data.birds.total}</p>
              <p className="text-sm">
                {t('dash.roosters')}: {num(data.birds.roosters, notSet)} · {t('dash.hens')}: {num(data.birds.hens, notSet)}
              </p>
              {data.birds.sexMissing > 0 ? <p className="text-sm text-ink-soft">{t('dash.sexMissing', { count: data.birds.sexMissing })}</p> : null}
              <ul className="mt-2 grid gap-1 text-sm">
                {data.birds.flocks.map((flock) => (
                  <li key={flock.id}>
                    <span className="font-semibold">{t('dash.flockDay', { code: flock.code, day: flock.ageDays === null ? notSet : flock.ageDays })}</span>
                    {' · '}
                    {t('dash.live', { count: flock.liveCount })}
                    {flock.sex ? ` · ${flock.sex.roosters} ${t('dash.roosters')}, ${flock.sex.hens} ${t('dash.hens')}` : ` · ${notSet}`}
                  </li>
                ))}
              </ul>
            </Card>
          </Link>
        ) : null}
        {data.eggs ? (
          <Link to={`/farms/${farmId}/eggs`} className="block">
            <Card>
              <Egg className="text-grove" aria-hidden="true" />
              <p className="text-sm text-ink-soft">{t('dash.eggs')}</p>
              <p className="font-display text-4xl font-semibold">{data.eggs.recordedToday ? data.eggs.today : notSet}</p>
              <p className="mt-2 text-sm text-ink-soft">{t('dash.week')}</p>
              <p className="text-sm">{data.eggs.days.map((day) => day.count).join(' · ')}</p>
            </Card>
          </Link>
        ) : null}
        {data.incubation ? (
          <Link to={`/farms/${farmId}/incubation`} className="block">
            <Card>
              <p className="text-sm text-ink-soft">{t('dash.sets')}</p>
              <p className="font-display text-4xl font-semibold">{data.incubation.openSittings}</p>
              <ul className="mt-2 grid gap-1 text-sm">
                {data.incubation.sittings.slice(0, 4).map((sitting) => (
                  <li key={sitting.id}>
                    {sitting.code}
                    {sitting.name ? ` · ${sitting.name}` : ''} · {t('dash.eggsSet', { count: sitting.eggCount })}
                    {' · '}
                    {t('dash.hatchDay')}: {notSet}
                    {sitting.lastCandledOn ? ` · ${t('dash.lastLook', { date: sitting.lastCandledOn })}` : ` · ${t('dash.candleDay')}: ${notSet}`}
                  </li>
                ))}
              </ul>
            </Card>
          </Link>
        ) : null}
        {data.tasks ? (
          <Link to={`/farms/${farmId}/tasks`} className="block">
            <Card>
              <p className="text-sm text-ink-soft">{t('dash.jobs')}</p>
              <p className="font-display text-4xl font-semibold">{data.tasks.dueToday + data.tasks.overdue}</p>
              <p className="text-sm">
                {t('dash.dueToday', { count: data.tasks.dueToday })} · {t('dash.late', { count: data.tasks.overdue })}
              </p>
            </Card>
          </Link>
        ) : null}
        {data.health ? (
          <Link to={`/farms/${farmId}/health`} className="block sm:col-span-2">
            <Card>
              <Stethoscope className="text-grove" aria-hidden="true" />
              <p className="font-display text-2xl">{t('dash.care')}</p>
              {care.length === 0 ? <p className="text-sm text-ink-soft">{t('dash.noCare')}</p> : null}
              <ul className="mt-2 grid gap-1 text-sm">
                {care.map((row) => (
                  <li key={row.id}>
                    <span className="font-semibold">{row.when === 'overdue' ? t('dash.lateShort') : row.when === 'today' ? t('dash.todayShort') : t('dash.soonShort')}</span>
                    {' · '}
                    {row.title} · {row.dueOn}
                  </li>
                ))}
              </ul>
              {data.health.notes.slice(0, 2).map((note) => (
                <p key={note.id} className="mt-2 text-sm text-ink-soft">
                  {note.observedOn}: {note.notes}
                </p>
              ))}
            </Card>
          </Link>
        ) : null}
        {data.stock ? (
          <Link to={`/farms/${farmId}/stock`} className="block">
            <Card>
              <Wheat className="text-grove" aria-hidden="true" />
              <p className="text-sm text-ink-soft">{t('dash.feed')}</p>
              <ul className="mt-2 grid gap-1 text-sm">
                {data.stock.items.slice(0, 4).map((item) => (
                  <li key={item.id}>
                    {item.name}: {item.onHand} {item.unitLabel}
                    {item.belowReorder ? ` · ${t('dash.low')}` : ''}
                  </li>
                ))}
              </ul>
            </Card>
          </Link>
        ) : null}
        {data.money ? (
          <Link to={`/farms/${farmId}/sales`} className="block">
            <Card>
              <p className="text-sm text-ink-soft">{t('dash.money')}</p>
              <p className="text-sm">
                {t('dash.sales')}: {data.money.sales?.status === 'typed' && data.money.sales.amount !== null ? data.money.sales.amount : notSet}
              </p>
              <p className="text-sm">
                {t('dash.spent')}:{' '}
                {data.money.expenses && data.money.expenses.length > 0
                  ? data.money.expenses.map((row) => `${row.amount} ${row.unitLabel}`).join(', ')
                  : notSet}
              </p>
              <p className="text-sm">{t('dash.owed')}: {notSet}</p>
            </Card>
          </Link>
        ) : null}
      </div>
      {data.attention.length > 0 ? (
        <Card>
          <p className="font-display text-2xl">{t('dash.attention')}</p>
          <ul className="mt-2 grid gap-1 text-sm">
            {data.attention.map((item) => (
              <li key={item.code}>
                <Link className="font-semibold text-grove underline" to={`/farms/${farmId}/${item.path}`}>
                  {t(`dash.att.${item.code}`, { count: item.count })}
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
      <span className="sr-only">
        <Bell aria-hidden="true" />
      </span>
    </div>
  );
}
