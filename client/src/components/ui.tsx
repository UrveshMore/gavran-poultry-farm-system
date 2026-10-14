import { Slot } from '@radix-ui/react-slot';
import { Label as RadixLabel } from '@radix-ui/react-label';
import { cva, type VariantProps } from 'class-variance-authority';
import { type ButtonHTMLAttributes, type ComponentProps, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from 'react';
import { localToday } from '@/lib/today';
import { cn } from '@/lib/utils';

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

export function Input({ className, type, max, min, allowFuture = false, ...props }: InputHTMLAttributes<HTMLInputElement> & { allowFuture?: boolean }) {
  const dateMax = type === 'date' && max === undefined && !allowFuture ? localToday() : max;
  const dateMin = type === 'date' && min === undefined ? '2000-01-01' : min;
  return (
    <input
      type={type}
      className={cn(
        'min-h-11 w-full rounded-xl border border-line bg-white px-3 text-base text-ink outline-none focus-visible:border-grove focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-grove',
        className,
      )}
      {...props}
      max={dateMax}
      min={dateMin}
    />
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
