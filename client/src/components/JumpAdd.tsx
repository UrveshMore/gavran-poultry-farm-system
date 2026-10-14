import type { ReactNode } from 'react';
import { Button } from '@/components/ui';

export function JumpAdd({ add, target, children }: { add: string; target: string; children: ReactNode }) {
  return (
    <Button
      type="button"
      className="min-h-14"
      data-add={add}
      onClick={() => document.getElementById(target)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
    >
      {children}
    </Button>
  );
}
