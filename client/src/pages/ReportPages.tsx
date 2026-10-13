import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { Alert, Button, Card, Field, Input } from '@/components/ui';
import { ApiError, api, errorKey } from '@/lib/api';
import type { FarmReport, ReportSection } from '@/lib/types';

function explain(error: unknown, t: (key: string) => string) {
  if (error instanceof ApiError) {
    if (error.status === 403) return t('common.permissionDenied');
    if (error.status === 404) return t('farm.notFound');
    const key = errorKey(error);
    return key ? t(key) : t('common.errorGeneric');
  }
  return t('common.errorGeneric');
}

export function ReportsPage() {
  const { farmId = '' } = useParams();
  const { t } = useTranslation();
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [range, setRange] = useState<{ from: string; to: string } | null>(null);
  const report = useQuery({
    queryKey: ['report', farmId, range?.from, range?.to],
    queryFn: () => api<FarmReport>(`/api/v1/farms/${farmId}/reports?from=${range?.from}&to=${range?.to}`),
    enabled: Boolean(range),
  });

  return (
    <div className="grid gap-4">
      <div>
        <h1 className="font-display text-3xl font-semibold">{t('reports.title')}</h1>
        <p className="mt-1 text-ink-soft">{t('reports.body')}</p>
      </div>
      <Card>
        <form
          className="grid gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            setRange({ from, to });
          }}
        >
          <Field id="report-from" label={t('reports.from')}>
            <Input id="report-from" type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
          </Field>
          <Field id="report-to" label={t('reports.to')}>
            <Input id="report-to" type="date" value={to} onChange={(event) => setTo(event.target.value)} />
          </Field>
          <Button type="submit">{t('reports.show')}</Button>
        </form>
      </Card>
      {!range ? <Card><p>{t('reports.choose')}</p></Card> : null}
      {report.isLoading ? <p>{t('common.loading')}</p> : null}
      {report.isError ? <Alert>{explain(report.error, t)}</Alert> : null}
      {report.data ? <ReportBody report={report.data} /> : null}
    </div>
  );
}

function ReportBody({ report }: { report: FarmReport }) {
  const { t, i18n } = useTranslation();
  const when = new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium', timeStyle: 'short', timeZone: report.timezone }).format(new Date(report.generatedAt));
  return (
    <div className="grid gap-4">
      <p className="text-sm text-ink-soft">
        {t('reports.range', { from: report.from, to: report.to, when, zone: report.timezone })}
      </p>
      <p className="rounded-xl bg-gold/30 px-3 py-2 text-sm">{t('reports.notOfficial')}</p>
      {report.sections.map((section) => (
        <SectionCard key={section.id} section={section} />
      ))}
    </div>
  );
}

function SectionCard({ section }: { section: ReportSection }) {
  const { t } = useTranslation();
  const status = t(`reports.status.${section.formula.status}`);
  return (
    <Card>
      <h2 className="font-display text-2xl">{t(`reports.section.${section.id}`)}</h2>
      <p className="text-sm font-semibold">{status}</p>
      <p className="text-sm text-ink-soft">{t(`reports.formula.${section.id}`)}</p>
      <p className="text-sm text-ink-soft">{t('reports.source', { table: section.sourceTable, count: section.rows.length })}</p>
      {section.id === 'eggs' ? <p className="mt-2 font-semibold">{t('reports.eggTotal', { count: section.total })}</p> : null}
      {section.id === 'expenses' && section.listedSums.length > 0 ? (
        <ul className="mt-2 grid gap-1 text-sm">
          {section.listedSums.map((sum) => (
            <li key={`${sum.direction}-${sum.unitLabel}`}>{t('reports.listedSum', { direction: t(sum.direction === 'income' ? 'expenses.income' : 'expenses.expense'), amount: sum.amount, unit: sum.unitLabel })}</li>
          ))}
        </ul>
      ) : null}
      {section.rows.length === 0 ? <p className="mt-2">{t('reports.empty')}</p> : (
        <ul className="mt-2 grid gap-2">
          {section.rows.map((row) => (
            <li key={row.id} className="rounded-xl bg-paper-deep px-3 py-2 text-sm">
              <RowLine section={section} row={row} />
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function RowLine({ section, row }: { section: ReportSection; row: ReportSection['rows'][number] }) {
  const { t } = useTranslation();
  if (section.id === 'movements' && 'movementType' in row) {
    return <span>{row.occurredOn} · {row.batchCode} · {row.movementType} · {row.birdCount}</span>;
  }
  if (section.id === 'eggs' && 'eggCount' in row && 'collectedOn' in row) {
    return <span>{row.collectedOn} · {t('reports.eggTotal', { count: row.eggCount })}</span>;
  }
  if (section.id === 'hatches' && 'proposedHatchRate' in row) {
    const percent = row.proposedHatchRate.percent;
    return <span>{row.hatchedOn} · {t('reports.hatchRow', { live: row.liveChicks, eggs: row.eggsSet, percent: percent ?? '—' })}</span>;
  }
  if (section.id === 'losses' && 'note' in row) {
    return <span>{row.occurredOn} · {row.birdCount} · {row.note}</span>;
  }
  if (section.id === 'expenses' && 'unitLabel' in row && 'direction' in row) {
    return <span>{row.occurredOn} · {t(row.direction === 'income' ? 'expenses.income' : 'expenses.expense')} · {row.amount} {row.unitLabel}</span>;
  }
  return null;
}
