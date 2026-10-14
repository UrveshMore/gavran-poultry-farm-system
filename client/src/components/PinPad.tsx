import { Button } from '@/components/ui';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'] as const;

export function PinPad({
  value,
  onChange,
  backLabel,
}: {
  value: string;
  onChange: (next: string) => void;
  backLabel: string;
}) {
  function press(digit: string) {
    if (value.length >= 6) return;
    onChange(`${value}${digit}`);
  }

  return (
    <div className="grid gap-3">
      <p className="text-center font-display text-3xl tracking-[0.4em] text-ink" aria-live="polite">
        {value.length === 0 ? '····' : '●'.repeat(value.length)}
      </p>
      <div className="grid grid-cols-3 gap-2">
        {KEYS.map((digit) => (
          <Button key={digit} type="button" className="min-h-14 text-2xl" onClick={() => press(digit)}>
            {digit}
          </Button>
        ))}
        <Button type="button" variant="outline" className="min-h-14 text-base" onClick={() => onChange(value.slice(0, -1))}>
          {backLabel}
        </Button>
        <Button type="button" className="min-h-14 text-2xl" onClick={() => press('0')}>
          0
        </Button>
        <span aria-hidden="true" />
      </div>
    </div>
  );
}
