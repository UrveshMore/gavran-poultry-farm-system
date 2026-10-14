import { Slot } from '@radix-ui/react-slot';
import { Label as RadixLabel } from '@radix-ui/react-label';
import { cva, type VariantProps } from 'class-variance-authority';
import { useLayoutEffect, useRef, useState, type ButtonHTMLAttributes, type ChangeEvent, type ComponentProps, type InputHTMLAttributes, type ReactNode, type Ref, type TextareaHTMLAttributes } from 'react';
import { useTranslation } from 'react-i18next';
import { localToday } from '@/lib/today';
import { cn } from '@/lib/utils';

export function isoToDmy(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : '';
}

export function dmyToIso(text: string): string | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text.trim());
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return `${match[3]}-${match[2]}-${match[1]}`;
}

const buttonVariants = cva(
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-base font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-grove disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-grove text-white hover:bg-grove-2',
        clay: 'bg-clay text-ink hover:bg-clay-2',
        outline: 'border border-line bg-white text-ink hover:bg-paper-deep',
        ghost: 'text-ink hover:bg-paper-deep',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

export function Button({
  className,
  variant,
  asChild = false,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : 'button';
  return <Comp className={cn(buttonVariants({ variant }), className)} {...props} />;
}

const fieldClass =
  'min-h-11 w-full rounded-xl border border-line bg-white px-3 text-base text-ink outline-none focus-visible:border-grove focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-grove';

export function Input({ className, type, max, min, allowFuture = false, ...props }: InputHTMLAttributes<HTMLInputElement> & { allowFuture?: boolean; ref?: Ref<HTMLInputElement> }) {
  const dateMax = type === 'date' && max === undefined && !allowFuture ? localToday() : max;
  const dateMin = type === 'date' && min === undefined ? '2000-01-01' : min;
  if (type === 'date') {
    return <DmyDate className={className} max={typeof dateMax === 'string' ? dateMax : undefined} min={typeof dateMin === 'string' ? dateMin : undefined} {...props} />;
  }
  return <input type={type} className={cn(fieldClass, className)} {...props} max={dateMax} min={dateMin} />;
}

function DmyDate({
  className,
  max,
  min,
  ref,
  name,
  value,
  defaultValue,
  onChange,
  onBlur,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { ref?: Ref<HTMLInputElement> }) {
  const { t } = useTranslation();
  const hidden = useRef<HTMLInputElement | null>(null);
  const controlled = value !== undefined;
  const [text, setText] = useState(() => isoToDmy(String(value ?? defaultValue ?? '')));

  useLayoutEffect(() => {
    if (controlled) setText(isoToDmy(String(value ?? '')));
  }, [controlled, value]);

  function assign(node: HTMLInputElement | null) {
    hidden.current = node;
    if (typeof ref === 'function') ref(node);
    else if (ref) ref.current = node;
    if (!node) return;
    setText(isoToDmy(node.value));
    const desc = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
    if (!desc?.get || !desc.set) return;
    const get = desc.get;
    const set = desc.set;
    Object.defineProperty(node, 'value', {
      configurable: true,
      get() {
        return get.call(this);
      },
      set(next: string) {
        set.call(this, next);
        setText(isoToDmy(String(next ?? '')));
      },
    });
  }

  function commit(next: string) {
    setText(next);
    const iso = next.trim() === '' ? '' : dmyToIso(next);
    if (iso === null) return;
    if (iso && max && iso > max) return;
    if (iso && min && iso < min) return;
    const node = hidden.current;
    if (node) {
      const desc = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
      desc?.set?.call(node, iso);
      node.dispatchEvent(new Event('input', { bubbles: true }));
      node.dispatchEvent(new Event('change', { bubbles: true }));
    }
    onChange?.({ target: { value: iso, name: name ?? '' }, currentTarget: { value: iso, name: name ?? '' } } as ChangeEvent<HTMLInputElement>);
  }

  return (
    <div className="grid gap-1">
      <input
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder="dd/mm/yyyy"
        className={cn(fieldClass, className)}
        value={text}
        aria-label={props['aria-label']}
        id={props.id}
        onBlur={onBlur}
        onChange={(event) => commit(event.target.value)}
      />
      <p className="text-xs text-ink-soft">{t('dates.example')}</p>
      <input type="hidden" name={name} ref={assign} onChange={() => undefined} defaultValue={controlled ? undefined : String(defaultValue ?? '')} value={controlled ? String(value ?? '') : undefined} />
    </div>
  );
}

export function Splash({ message }: { message?: string }) {
  const { t } = useTranslation();
  return (
    <div className="grid min-h-dvh place-items-center bg-paper px-6">
      <div className="grid justify-items-center gap-4">
        <Logo className="h-20 w-20" />
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-grove border-t-transparent" role="status" aria-label={t('common.loading')} />
        {message ? <p className="max-w-sm text-center text-ink-soft">{message}</p> : null}
      </div>
    </div>
  );
}

export function TextArea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        'min-h-24 w-full rounded-xl border border-line bg-white px-3 py-2 text-base text-ink outline-none focus-visible:border-grove focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-grove',
        className,
      )}
      {...props}
    />
  );
}

export function Label({ className, ...props }: ComponentProps<typeof RadixLabel>) {
  return <RadixLabel className={cn('text-sm font-semibold text-ink', className)} {...props} />;
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <section className={cn('rounded-2xl border border-line bg-white/90 p-4 shadow-sm', className)}>{children}</section>;
}

export function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint ? (
        <p id={`${id}-hint`} className="text-sm text-ink-soft">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className="text-sm font-semibold text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function Alert({ tone = 'danger', children }: { tone?: 'danger' | 'ok'; children: ReactNode }) {
  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className={cn('rounded-xl px-3 py-3 text-sm font-semibold', tone === 'danger' ? 'bg-danger-bg text-danger' : 'bg-ok-bg text-grove')}
    >
      {children}
    </div>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={cn('h-10 w-10', className)} aria-hidden="true">
      <rect width="64" height="64" rx="14" fill="#2f6b3a" />
      <circle cx="30" cy="36" r="14" fill="#f4e9c9" />
      <circle cx="35" cy="33" r="1.8" fill="#1b1914" />
      <path d="M42 35h10l-6 4z" fill="#c4522a" />
      <path d="M22 24c2-6 4-6 6 0 2-7 5-8 7 0" fill="none" stroke="#e0b15a" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
