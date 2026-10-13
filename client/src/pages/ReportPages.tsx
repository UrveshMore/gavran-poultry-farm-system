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
  const [shedId, setShedId] = useState('');
  const [batchId, setBatchId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [range, setRange] = useState<{ from: string; to: string; shedId: string; batchId: string; categoryId: string } | null>(null);
  const sheds = useQuery({ queryKey: ['sheds', farmId], queryFn: () => api<Array<{ id: string; code: string }>>(`/api/v1/farms/${farmId}/sheds`) });
  const batches = useQuery({ queryKey: ['batches', farmId], queryFn: () => api<Array<{ id: string; code: string }>>(`/api/v1/farms/${farmId}/batches`) });
  const eggCategories = useQuery({ queryKey: ['egg-categories', farmId], queryFn: () => api<Array<{ id: string; name: string }>>(`/api/v1/farms/${farmId}/egg-categories`) });
  const expenses = useQuery({ queryKey: ['expenses', farmId], queryFn: () => api<{ categories: Array<{ id: string; name: string }> }>(`/api/v1/farms/${farmId}/expenses`) });
  const report = useQuery({
    queryKey: ['report', farmId, range],
    queryFn: () => {
      const params = new URLSearchParams({ from: range?.from ?? '', to: range?.to ?? '' });
      if (range?.shedId) params.set('shedId', range.shedId);
      if (range?.batchId) params.set('batchId', range.batchId);
      if (range?.categoryId) params.set('categoryId', range.categoryId);
      return api<FarmReport>(`/api/v1/farms/${farmId}/reports?${params.toString()}`);
    },
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
            setRange({ from, to, shedId, batchId, categoryId });
          }}
        >
          <Field id="report-from" label={t('reports.from')}>
            <Input id="report-from" type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
          </Field>
          <Field id="report-to" label={t('reports.to')}>
            <Input id="report-to" type="date" value={to} onChange={(event) => setTo(event.target.value)} />
          </Field>
          <Field id="report-shed" label={`${t('reports.shed')} (${t('common.optional')})`}>
            <select id="report-shed" className="min-h-11 w-full rounded-xl border border-line bg-white px-3" value={shedId} onChange={(event) => setShedId(event.target.value)}>
              <option value="">{t('reports.any')}</option>
              {(sheds.data ?? []).map((shed) => <option key={shed.id} value={shed.id}>{shed.code}</option>)}
            </select>
          </Field>
          <Field id="report-batch" label={`${t('reports.batch')} (${t('common.optional')})`}>
            <select id="report-batch" className="min-h-11 w-full rounded-xl border border-line bg-white px-3" value={batchId} onChange={(event) => setBatchId(event.target.value)}>
              <option value="">{t('reports.any')}</option>
              {(batches.data ?? []).map((batch) => <option key={batch.id} value={batch.id}>{batch.code}</option>)}
            </select>
          </Field>
          <Field id="report-category" label={`${t('reports.category')} (${t('common.optional')})`}>
            <select id="report-category" className="min-h-11 w-full rounded-xl border border-line bg-white px-3" value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
              <option value="">{t('reports.any')}</option>
              {(eggCategories.data ?? []).map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
              {(expenses.data?.categories ?? []).map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
            </select>
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
      <Button
        type="button"
        onClick={() => {
          const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = 'gavran-report.json';
          link.click();
          URL.revokeObjectURL(url);
        }}
      >
        {t('reports.download')}
      </Button>
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
  if (section.id === 'attendance' && 'methodLabel' in row) {
    return <span>{row.attendedOn} · {row.methodLabel}</span>;
  }
  if (section.id === 'parentage' && 'sireNote' in row) {
    return <span>{row.recordedOn} · {row.sireNote} · {row.damNote}</span>;
  }
  if (section.id === 'receipts' && 'acceptedQuantity' in row) {
    return <span>{row.receivedOn} · {row.acceptedQuantity} / {row.rejectedQuantity} {row.unitLabel}</span>;
  }
  if (section.id === 'invoiceDocuments' && 'issuedOn' in row) {
    return <span>{row.issuedOn} · {row.status}</span>;
  }
  if (section.id === 'returns' && 'returnedOn' in row) {
    return <span>{row.returnedOn} · {row.description} · {row.quantity}</span>;
  }
  return null;
}
