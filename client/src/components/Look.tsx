import { Lightbulb, Plus, Search, SlidersHorizontal, X } from 'lucide-react';
import type { ReactNode } from 'react';

export function PageHead({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header>
      <h1 className="font-display text-[2rem] font-semibold leading-tight tracking-tight text-ink">{title}</h1>
      {subtitle ? <p className="mt-1 text-sm text-ink-soft">{subtitle}</p> : null}
    </header>
  );
}

export function Pills({
  value,
  options,
  onChange,
}: {
  value: string;
  options: { id: string; label: string }[];
  onChange: (id: string) => void;
}) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {options.map((option) => {
        const on = value === option.id;
        return (
          <button
            key={option.id}
            type="button"
            data-tab={option.id}
            aria-pressed={on}
            onClick={() => onChange(option.id)}
            className={`min-h-10 shrink-0 rounded-full px-4 text-sm font-semibold ${on ? 'bg-grove text-white' : 'bg-white text-ink-soft shadow-[0_4px_16px_rgba(31,77,43,0.05)]'}`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export function Chip({ tone, children }: { tone: 'active' | 'done' | 'grow' | 'shed'; children: ReactNode }) {
  const toneClass = {
    active: 'bg-[#E5F6EA] text-grove',
    done: 'bg-[#EEF0F2] text-[#667078]',
    grow: 'bg-[#FFF1DE] text-[#C47A22]',
    shed: 'bg-[#E5F6EA] text-grove',
  }[tone];
  return <span className={`inline-flex shrink-0 items-center rounded-full px-3 py-1 text-xs font-semibold ${toneClass}`}>{children}</span>;
}

export function Tile({ src, tint }: { src: string; tint: string }) {
  return (
    <span className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-2xl" style={{ backgroundColor: tint }}>
      <img src={src} alt="" className="h-12 w-12 object-contain" />
    </span>
  );
}

export function Tip({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-3 rounded-3xl bg-[#FBF6E4] px-4 py-3 text-sm leading-snug text-ink">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#F6E7A8] text-[#8A6A12]">
        <Lightbulb aria-hidden="true" size={18} />
      </span>
      <p>{children}</p>
    </div>
  );
}

export function SearchRow({
  id,
  value,
  onChange,
  placeholder,
  onFilter,
  filterLabel,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  onFilter: () => void;
  filterLabel: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <label className="flex min-h-12 flex-1 items-center gap-2 rounded-2xl bg-white px-3 shadow-[0_4px_16px_rgba(31,77,43,0.05)]">
        <Search aria-hidden="true" size={18} className="text-ink-soft" />
        <input id={id} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} className="min-h-11 w-full bg-transparent text-base text-ink outline-none" />
      </label>
      <button type="button" data-filter-open aria-label={filterLabel} onClick={onFilter} className="grid h-12 w-12 place-items-center rounded-2xl bg-white text-ink shadow-[0_4px_16px_rgba(31,77,43,0.05)]">
        <SlidersHorizontal aria-hidden="true" size={18} />
      </button>
    </div>
  );
}

export function Fab({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      data-fab="add"
      aria-label={label}
      onClick={onClick}
      className="fixed bottom-24 right-[max(1rem,calc(50%-13rem))] z-30 grid h-14 w-14 place-items-center rounded-full bg-grove text-white shadow-[0_10px_24px_rgba(31,77,43,0.28)]"
    >
      <Plus aria-hidden="true" size={28} />
    </button>
  );
}

export function Sheet({
  open,
  title,
  onClose,
  closeLabel,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  closeLabel: string;
  children: ReactNode;
}) {
  return (
    <div className={open ? 'fixed inset-0 z-40 flex items-end justify-center bg-ink/40' : 'hidden'} role="dialog" aria-hidden={open ? undefined : true}>
      <div data-sheet={open ? 'open' : 'closed'} className="max-h-[86dvh] w-full max-w-md overflow-y-auto rounded-t-[1.75rem] bg-paper px-4 pb-10 pt-3 shadow-2xl">
        <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-line" />
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="font-display text-2xl font-semibold">{title}</p>
          <button type="button" className="grid h-11 w-11 place-items-center rounded-full bg-white text-ink" onClick={onClose} aria-label={closeLabel}>
            <X aria-hidden="true" size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
