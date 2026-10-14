import type { DashboardData } from '@/components/DashboardCards';
import { SeasonCard } from '@/pages/DesiPages';
import { Button, Card } from '@/components/ui';
import { api } from '@/lib/api';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Bird, Egg, ShoppingBasket, Wheat } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

type Point = { date: string; count: number };

function dayLabel(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return match ? `${match[3]}/${match[2]}` : iso;
}

function Trend({ points, label }: { points: Point[]; label: string }) {
  const width = 280;
  const height = 96;
  const max = Math.max(1, ...points.map((point) => point.count));
  const step = points.length > 1 ? width / (points.length - 1) : width;
  const line = points
    .map((point, index) => {
      const x = index * step;
      const y = height - 8 - (point.count / max) * (height - 16);
      return `${index === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(' ');
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-28 w-full text-grove" role="img" aria-label={label}>
      <path d={line || 'M 0 88 L 280 88'} fill="none" stroke="currentColor" strokeWidth="3" />
      {points.map((point, index) => (
        <text key={point.date} x={index * step} y={height} fontSize="10" fill="currentColor">
          {index % 2 === 0 ? dayLabel(point.date) : ''}
        </text>
      ))}
    </svg>
  );
}

function hourOf(minute: number): number {
  return Math.floor(minute / 60);
}

export function FarmCharts({ farmId, data }: { farmId: string; data: DashboardData }) {
  const { t } = useTranslation();
  const charts = data.charts;
  const notSet = t('dash.notSet');
  if (!charts) return null;
  return (
    <div className="grid gap-3">
      <h2 className="font-display text-2xl font-semibold">{t('dash.chart.money')}</h2>
      {charts.eggs.length > 0 ? (
        <Card>
          <Egg className="text-grove" aria-hidden="true" />
          <p className="font-display text-xl">{t('dash.chart.eggs')}</p>
          <Trend points={charts.eggs} label={t('dash.chart.eggs')} />
        </Card>
      ) : null}
      {charts.losses.length > 0 ? (
        <Card>
          <Bird className="text-grove" aria-hidden="true" />
          <p className="font-display text-xl">{t('dash.chart.losses')}</p>
          <p className="text-sm text-ink-soft">{t('dash.chart.lossesNote')}</p>
          <Trend points={charts.losses} label={t('dash.chart.losses')} />
        </Card>
      ) : null}
      <Card>
        <Wheat className="text-grove" aria-hidden="true" />
        <p className="font-display text-xl">{t('dash.chart.feed')}</p>
        {charts.feed.unitLabel && charts.feed.days.length > 0 ? (
          <>
            <p className="text-sm text-ink-soft">{charts.feed.unitLabel}</p>
            <Trend points={charts.feed.days.map((day) => ({ date: day.date, count: day.quantity }))} label={t('dash.chart.feed')} />
          </>
        ) : (
          <p className="text-sm text-ink-soft">{t('dash.chart.feedEmpty')}</p>
        )}
      </Card>
      <Card>
        <Bird className="text-grove" aria-hidden="true" />
        <p className="font-display text-xl">{t('dash.chart.sex')}</p>
        <ul className="mt-2 grid gap-1 text-sm">
          {charts.flocks.map((flock) => (
            <li key={flock.code}>
              <span className="font-semibold">{flock.code}</span>
              {' · '}
              {flock.roosters === null ? notSet : flock.roosters} / {flock.hens === null ? notSet : flock.hens}
            </li>
          ))}
        </ul>
        {charts.flocks.length === 0 ? <p className="text-sm text-ink-soft">{notSet}</p> : null}
      </Card>
      <Card>
        <ShoppingBasket className="text-grove" aria-hidden="true" />
        <p className="font-display text-xl">{t('dash.chart.money')}</p>
        <p className="text-sm text-ink-soft">{t('dash.chart.moneyNote')}</p>
        <ul className="mt-2 grid gap-2 text-sm">
          {charts.money.map((row, index) => (
            <li key={`${row.unitLabel ?? 'sales'}-${index}`} className="rounded-xl bg-paper px-3 py-2">
              <p className="font-semibold">{row.unitLabel ?? t('dash.chart.sales')}</p>
              <p>
                {t('dash.chart.income')}: {row.income === null ? notSet : row.income}
                {' · '}
                {t('dash.chart.kharch')}: {row.kharch === null ? notSet : row.kharch}
              </p>
              <p>
                {t('dash.chart.difference')}: {row.difference === null ? notSet : row.difference}
              </p>
            </li>
          ))}
        </ul>
        {charts.money.length === 0 ? <p className="text-sm">{notSet}</p> : null}
      </Card>
      <SeasonCard farmId={farmId} />
      {data.phone ? <PhoneSettings farmId={farmId} phone={data.phone} /> : null}
    </div>
  );
}

function PhoneSettings({ farmId, phone }: { farmId: string; phone: NonNullable<DashboardData['phone']> }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [form, setForm] = useState(phone);
  const [note, setNote] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: () => api(`/api/v1/farms/${farmId}/phone-alerts`, { method: 'PUT', json: form }),
    onSuccess: async () => {
      setNote(t('phone.saved'));
      localStorage.removeItem(`gavran.phone.sync.${farmId}.${''}`);
      await queryClient.invalidateQueries({ queryKey: ['dashboard', farmId] });
    },
  });
  const hours = Array.from({ length: 24 }, (_, hour) => hour);
  return (
    <Card>
      <h2 className="font-display text-xl">{t('phone.settings')}</h2>
      <p className="text-sm text-ink-soft">{t('phone.localOnly')}</p>
      <div className="mt-3 grid gap-3">
        <label className="flex min-h-11 items-center gap-2 text-sm font-semibold">
          <input type="checkbox" checked={form.morningOn} onChange={(event) => setForm({ ...form, morningOn: event.target.checked })} />
          {t('phone.morning')}
          <select className="min-h-11 rounded-xl border border-line bg-white px-2" value={hourOf(form.morningMinute)} onChange={(event) => setForm({ ...form, morningMinute: Number(event.target.value) * 60 })} aria-label={t('phone.morning')}>
            {hours.map((hour) => (
              <option key={hour} value={hour}>
                {String(hour).padStart(2, '0')}:00
              </option>
            ))}
          </select>
        </label>
        <label className="flex min-h-11 items-center gap-2 text-sm font-semibold">
          <input type="checkbox" checked={form.eveningOn} onChange={(event) => setForm({ ...form, eveningOn: event.target.checked })} />
          {t('phone.evening')}
          <select className="min-h-11 rounded-xl border border-line bg-white px-2" value={hourOf(form.eveningMinute)} onChange={(event) => setForm({ ...form, eveningMinute: Number(event.target.value) * 60 })} aria-label={t('phone.evening')}>
            {hours.map((hour) => (
              <option key={hour} value={hour}>
                {String(hour).padStart(2, '0')}:00
              </option>
            ))}
          </select>
        </label>
        <label className="flex min-h-11 items-center gap-2 text-sm font-semibold">
          <input type="checkbox" checked={form.lowStockOn} onChange={(event) => setForm({ ...form, lowStockOn: event.target.checked })} />
          {t('phone.low')}
        </label>
        <label className="flex min-h-11 items-center gap-2 text-sm font-semibold">
          <input type="checkbox" checked={form.eggsOn} onChange={(event) => setForm({ ...form, eggsOn: event.target.checked })} />
          {t('phone.eggs')}
        </label>
        <Button type="button" disabled={save.isPending} onClick={() => save.mutate()}>
          {t('phone.save')}
        </Button>
        {note ? <p role="status">{note}</p> : null}
      </div>
    </Card>
  );
}
