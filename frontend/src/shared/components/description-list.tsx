import type { ReactNode } from 'react';
import { cn } from '@/shared/lib/utils';

export interface DescriptionItem {
  label: string;
  value: ReactNode;
  /** 여러 열 배치에서 한 줄 전체를 사용 */
  wide?: boolean;
}

/** 상세 정보 라벨-값 목록 (cols 쌍으로 배치) */
export function DescriptionList({ items, cols = 1, className }: { items: DescriptionItem[]; cols?: 1 | 2 | 3; className?: string }) {
  return (
    <dl
      className={cn('desc-list', className)}
      style={{ gridTemplateColumns: Array.from({ length: cols }, () => 'minmax(6rem,auto) minmax(0,1fr)').join(' ') }}
    >
      {items.map((item) => (
        <div key={item.label} className="contents">
          <dt className="desc-term">{item.label}</dt>
          <dd className="min-w-0" style={item.wide ? { gridColumn: `span ${cols * 2 - 1}` } : undefined}>
            {item.value ?? '-'}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** 강조 수치 박스 (실적 요약 등) */
export function StatBox({ label, value, className }: { label: string; value: ReactNode; className?: string }) {
  return (
    <div className={cn('rounded-md border bg-muted/30 px-3 py-2', className)}>
      <div className="sub-text">{label}</div>
      <div className="mt-0.5 font-semibold tabular-nums">{value}</div>
    </div>
  );
}
