import { Link } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { Skeleton } from '@/shared/ui/skeleton';
import { cn } from '@/shared/lib/utils';

const toneClass = {
  default: 'bg-primary/10 text-primary',
  success: 'bg-success/10 text-success',
  destructive: 'bg-destructive/10 text-destructive',
  warning: 'bg-warning/15 text-warning-foreground',
  info: 'bg-info/10 text-info',
} as const;

/** 대시보드 KPI 카드 */
export function KpiCard({
  icon,
  label,
  value,
  sub,
  tone = 'default',
  to,
  testId,
}: {
  icon: ReactNode;
  label: string;
  value?: string;
  sub?: string;
  tone?: keyof typeof toneClass;
  to?: string;
  testId?: string;
}) {
  const body = (
    <div className={cn('panel flex h-full items-center gap-3 px-4 py-3', to && 'transition-colors hover:border-primary/40')} data-testid={testId}>
      <div className={cn('flex size-10 shrink-0 items-center justify-center rounded-md [&_svg]:size-5', toneClass[tone])}>{icon}</div>
      <div className="min-w-0">
        <div className="truncate text-[12.5px] text-muted-foreground">{label}</div>
        {value === undefined ? <Skeleton className="mt-1 h-6 w-16" /> : <div className="text-2xl font-bold tabular-nums">{value}</div>}
        {sub && <div className="sub-text truncate">{sub}</div>}
      </div>
    </div>
  );
  return to ? (
    <Link to={to} className="block h-full">
      {body}
    </Link>
  ) : (
    body
  );
}
