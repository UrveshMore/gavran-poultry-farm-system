import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Alert, Button, Card, Field, TextArea } from '@/components/ui';
import { ApiError, api, errorKey } from '@/lib/api';
import { postOrQueue } from '@/lib/offlineQueue';
import { withServer } from '@/lib/serverAddress';

export type DoseSlot = 'morning' | 'evening' | 'full_day';

export type DoseLine = {
  rowId: string;
  day: number | null;
  date: string | null;
  dayLabel: string;
  slot: DoseSlot;
  itemName: string;
  amountText: string;
  unclear: boolean;
  sourceFile: string;
  sourcePage: number;
  amountPage: number | null;
  medicineKeys: string[];
  given: boolean;
  origin: 'paper' | 'owner';
};

export type DoseDay = { day: number; date: string | null; today: boolean; lines: DoseLine[] };

export type BatchDoses = {
  approved: boolean;
  batchCode: string;
  hatchDate: string | null;
  ageDays: number | null;
  paperDay: number | null;
  today: string;
  sourceFile: string;
  todayLines: DoseLine[];
  tomorrowLines: DoseLine[];
  weekLines: DoseLine[];
  undated: DoseLine[];
  days: DoseDay[];
};

export type DoseGroup = { batchId: string; batchCode: string; paperDay: number | null; lines: DoseLine[] };

function explain(error: unknown, t: (key: string) => string) {
  if (error instanceof ApiError) {
    if (error.status === 403) return t('common.permissionDenied');
    const key = errorKey(error);
    if (key) return t(key);
    if (error.message) return error.message;
  }
  return t('common.errorGeneric');
}

function MedicinePhoto({ farmId, medicineKey, canUpload }: { farmId: string; medicineKey: string; canUpload: boolean }) {
  const { t } = useTranslation();
  const [bust, setBust] = useState(0);
  const [failed, setFailed] = useState(false);
  const upload = useMutation({
    mutationFn: (file: File) => {
      const form = new FormData();
      form.set('file', file);
      return api(`/api/v1/farms/${farmId}/medicine-photos/${medicineKey}`, { method: 'POST', form });
    },
    onSuccess: () => {
      setFailed(false);
      setBust((value) => value + 1);
    },
  });
  return (
    <div className="grid justify-items-center gap-1">
      {failed ? (
        <span className="flex h-16 w-16 items-center justify-center rounded-xl bg-paper-deep text-xs font-semibold">{t('doses.noPhoto')}</span>
      ) : (
        <img
          src={withServer(`/api/v1/farms/${farmId}/medicine-photos/${medicineKey}?v=${bust}`)}
          alt={medicineKey}
          className="h-16 w-16 object-contain"
          onError={() => setFailed(true)}
        />
      )}
      {canUpload ? (
        <label className="cursor-pointer text-xs font-semibold text-grove underline">
          {t('doses.upload')}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) upload.mutate(file);
            }}
          />
        </label>
      ) : null}
      {upload.isError ? <span className="text-xs text-ink-soft">{explain(upload.error, t)}</span> : null}
    </div>
  );
}

export function DoseLineRow({
  farmId,
  batchId,
  line,
  approved,
  canRecord,
  canUpload,
}: {
  farmId: string;
  batchId: string;
  line: DoseLine;
  approved: boolean;
  canRecord: boolean;
  canUpload: boolean;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const mark = useMutation({
    mutationFn: () =>
      postOrQueue(farmId, `/api/v1/farms/${farmId}/batches/${batchId}/doses`, { rowId: line.rowId, givenOn: line.date }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['batch-doses', farmId, batchId] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard', farmId] });
    },
  });
  const slot = t(`doses.slot.${line.slot}`);
  return (
    <div className="grid gap-2 border-t border-line py-3 first:border-t-0" data-dose-line={line.rowId}>
      <p className="font-semibold">
        {line.day === null ? line.dayLabel : t('doses.dayLine', { day: line.day, slot, item: line.itemName })}
      </p>
      <p className="text-sm">{line.unclear ? t('doses.checkVet') : line.amountText}</p>
      <p className="text-xs text-ink-soft">
        {line.origin === 'owner' ? t('medicines.addedByOwner') : t('doses.source', { file: line.sourceFile, page: line.sourcePage })}
        {line.amountPage ? ` · ${t('doses.amountFrom', { page: line.amountPage })}` : ''}
      </p>
      <div className="flex flex-wrap items-end gap-3">
        {line.medicineKeys.map((key) => (
          <MedicinePhoto key={key} farmId={farmId} medicineKey={key} canUpload={canUpload && line.origin !== 'owner'} />
        ))}
        {canRecord && (approved || line.origin === 'owner') ? (
          <div>
            <Button
              type="button"
              variant={line.given ? 'outline' : 'default'}
              disabled={line.given || mark.isPending || !line.date}
              data-dose-tick={line.rowId}
              onClick={() => mark.mutate()}
            >
              {line.given ? t('doses.given') : t('doses.markGiven')}
            </Button>
            {!line.date ? <p className="text-sm text-ink-soft">{t('doses.noDay')}</p> : null}
          </div>
        ) : null}
      </div>
      {mark.isError ? <Alert>{explain(mark.error, t)}</Alert> : null}
    </div>
  );
}

function DayBlock({
  farmId,
  batchId,
  day,
  paperDay,
  approved,
  canRecord,
  canUpload,
}: {
  farmId: string;
  batchId: string;
  day: DoseDay;
  paperDay: number | null;
  approved: boolean;
  canRecord: boolean;
  canUpload: boolean;
}) {
  const { t } = useTranslation();
  const label = day.today ? t('doses.today') : paperDay !== null && day.day === paperDay + 1 ? t('doses.tomorrow') : t('doses.dayOnly', { day: day.day });
  return (
    <article
      className={day.today ? 'rounded-2xl border-2 border-gold bg-gold/30 p-3' : 'rounded-2xl border border-line p-3'}
      data-today={day.today ? 'yes' : 'no'}
    >
      <h3 className="font-display text-xl font-semibold">{label}</h3>
      {day.date ? <p className="text-sm text-ink-soft">{day.date}</p> : null}
      {day.lines.length === 0 ? <p className="mt-1 text-sm text-ink-soft">{t('doses.noneThisDay')}</p> : null}
      {day.lines.map((line) => (
        <DoseLineRow
          key={`${line.rowId}-${day.day}`}
          farmId={farmId}
          batchId={batchId}
          line={line}
          approved={approved}
          canRecord={canRecord}
          canUpload={canUpload}
        />
      ))}
    </article>
  );
}

export function MedicineToday({
  farmId,
  doses,
  canRecord,
}: {
  farmId: string;
  doses: { approved: boolean; groups: DoseGroup[] } | null;
  canRecord: boolean;
}) {
  const { t } = useTranslation();
  if (!doses) return null;
  return (
    <Card className="sm:col-span-2">
      <h2 id="medicine-today" className="font-display text-2xl">{t('dash.medicine')}</h2>
      {doses.approved ? null : <p className="mt-1 text-sm">{t('doses.paperUnchecked')}</p>}
      {doses.approved && doses.groups.length === 0 ? <p className="mt-1 text-sm text-ink-soft">{t('dash.noMedicine')}</p> : null}
      <div className="mt-2 grid gap-3">
        {doses.groups.map((group) => (
          <div key={group.batchId}>
            <Link className="font-semibold text-grove underline" to={`/farms/${farmId}/batches/${group.batchId}`}>
              {group.paperDay ? t('doses.batchPaper', { code: group.batchCode, day: group.paperDay }) : group.batchCode}
            </Link>
            {group.lines.map((line) => (
              <DoseLineRow
                key={line.rowId}
                farmId={farmId}
                batchId={group.batchId}
                line={line}
                approved={doses.approved}
                canRecord={canRecord}
                canUpload={false}
              />
            ))}
          </div>
        ))}
      </div>
    </Card>
  );
}

export function BatchDosePanel({
  farmId,
  batchId,
  canRead,
  canRecord,
  canApprove,
}: {
  farmId: string;
  batchId: string;
  canRead: boolean;
  canRecord: boolean;
  canApprove: boolean;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [note, setNote] = useState('');
  const doses = useQuery({
    queryKey: ['batch-doses', farmId, batchId],
    queryFn: () => api<BatchDoses>(`/api/v1/farms/${farmId}/batches/${batchId}/doses`),
    enabled: canRead,
  });
  const approve = useMutation({
    mutationFn: () => api(`/api/v1/farms/${farmId}/dose-schedule/approval`, { method: 'POST', json: { verificationNote: note } }),
    onSuccess: () => {
      setNote('');
      void queryClient.invalidateQueries({ queryKey: ['batch-doses', farmId, batchId] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard', farmId] });
    },
  });
  if (!canRead) return null;
  if (doses.isLoading) return <p>{t('common.loading')}</p>;
  if (doses.isError || !doses.data) return <Alert>{explain(doses.error, t)}</Alert>;
  const data = doses.data;
  const paperDay = data.paperDay;
  const looseSeen = new Set<string>();
  const loose = [...data.todayLines, ...data.tomorrowLines, ...data.weekLines].filter((line) => {
    if (line.origin !== 'owner' || line.day !== null) return false;
    const key = `${line.rowId}|${line.date ?? ''}`;
    if (looseSeen.has(key)) return false;
    looseSeen.add(key);
    return true;
  });
  const week = paperDay === null ? [] : data.days.filter((day) => day.day >= paperDay && day.day <= paperDay + 6);
  const earlier = paperDay === null ? [] : data.days.filter((day) => day.day < paperDay);
  const later = paperDay === null ? data.days : data.days.filter((day) => day.day > paperDay + 6);
  return (
    <Card>
      <h2 className="font-display text-2xl">{t('doses.title')}</h2>
      <p className="mt-1 text-sm text-ink-soft">{t('doses.hatchIsDayOne')}</p>
      <p className="text-xs text-ink-soft">{data.sourceFile}</p>
      {paperDay === null ? <p className="mt-2 text-sm">{t('doses.needHatch')}</p> : null}
      {data.approved ? null : <p className="mt-2 text-sm">{t('doses.paperUnchecked')}</p>}
      {!data.approved && canApprove ? (
        <form
          className="mt-3 grid gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            approve.mutate();
          }}
        >
          <Field id="dose-note" label={t('doses.note')} hint={t('doses.approveHint')}>
            <TextArea id="dose-note" value={note} onChange={(event) => setNote(event.target.value)} />
          </Field>
          {approve.isError ? <Alert>{explain(approve.error, t)}</Alert> : null}
          <Button type="submit" disabled={approve.isPending || note.trim().length === 0}>
            {t('doses.approve')}
          </Button>
        </form>
      ) : null}
      {week.length > 0 ? (
        <div className="mt-4 grid gap-3">
          <h3 className="font-display text-xl">{t('doses.thisWeek')}</h3>
          {week.map((day) => (
            <DayBlock
              key={day.day}
              farmId={farmId}
              batchId={batchId}
              day={day}
              paperDay={paperDay}
              approved={data.approved}
              canRecord={canRecord}
              canUpload={canApprove}
            />
          ))}
        </div>
      ) : null}
      {earlier.length > 0 ? (
        <details className="mt-4">
          <summary className="min-h-11 cursor-pointer font-semibold">{t('doses.earlier')}</summary>
          <div className="mt-2 grid gap-3">
            {earlier.map((day) => (
              <DayBlock
                key={day.day}
                farmId={farmId}
                batchId={batchId}
                day={day}
                paperDay={paperDay}
                approved={data.approved}
                canRecord={canRecord}
                canUpload={canApprove}
              />
            ))}
          </div>
        </details>
      ) : null}
      {later.length > 0 ? (
        <details className="mt-4">
          <summary className="min-h-11 cursor-pointer font-semibold">{t('doses.later')}</summary>
          <div className="mt-2 grid gap-3">
            {later.map((day) => (
              <DayBlock
                key={day.day}
                farmId={farmId}
                batchId={batchId}
                day={day}
                paperDay={paperDay}
                approved={data.approved}
                canRecord={canRecord}
                canUpload={canApprove}
              />
            ))}
          </div>
        </details>
      ) : null}
      {loose.length > 0 ? (
        <div className="mt-4 grid gap-3">
          <h3 className="font-display text-xl">{t('doses.today')}</h3>
          {loose.map((line) => (
            <div key={`${line.rowId}-${line.date ?? ''}`}>
              {line.date ? <p className="text-sm text-ink-soft">{line.date}</p> : null}
              <DoseLineRow
                farmId={farmId}
                batchId={batchId}
                line={line}
                approved={data.approved}
                canRecord={canRecord}
                canUpload={false}
              />
            </div>
          ))}
        </div>
      ) : null}
      {data.undated.length > 0 ? (
        <div className="mt-4">
          <h3 className="font-display text-xl">{t('doses.noDay')}</h3>
          {data.undated.map((line) => (
            <DoseLineRow
              key={line.rowId}
              farmId={farmId}
              batchId={batchId}
              line={line}
              approved={data.approved}
              canRecord={false}
              canUpload={canApprove}
            />
          ))}
        </div>
      ) : null}
    </Card>
  );
}
