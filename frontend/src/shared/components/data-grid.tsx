import { Inbox } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Skeleton } from '@/shared/ui/skeleton';
import { cn } from '@/shared/lib/utils';
import { Pagination } from './pagination';
import { ErrorState } from './query-state';

export interface GridColumn<T> {
  key: string;
  header: ReactNode;
  cell: (row: T, index: number) => ReactNode;
  align?: 'left' | 'right' | 'center';
  width?: number | string;
  /** 긴 텍스트 줄바꿈 허용 */
  wrap?: boolean;
  className?: string;
}

interface QueryLike {
  isPending: boolean;
  isError: boolean;
  error: unknown;
  refetch: () => unknown;
}

/**
 * 데이터 그리드 — 목록 화면 공통 표.
 * 컬럼 정의만 넘기면 헤더 고정, 로딩(스켈레톤)·오류(다시 시도)·결과 없음·선택 행·페이지네이션을 일관되게 처리합니다.
 */
export function DataGrid<T>({
  columns,
  rows,
  rowKey,
  query,
  emptyMessage,
  onRowClick,
  selectedKey,
  pagination,
  maxHeight,
  rowTestId,
  skeletonRows = 5,
}: {
  columns: GridColumn<T>[];
  rows: T[] | undefined;
  rowKey: (row: T) => string | number;
  query?: QueryLike;
  emptyMessage?: string;
  onRowClick?: (row: T) => void;
  selectedKey?: string | number | null;
  pagination?: { page: number; pageSize: number; total: number; onPageChange: (page: number) => void };
  maxHeight?: number | string;
  rowTestId?: (row: T) => string;
  skeletonRows?: number;
}) {
  const { t } = useTranslation();
  const list = rows ?? [];
  const alignClass = (a?: GridColumn<T>['align']) => (a === 'right' ? 'text-right' : a === 'center' ? 'text-center' : '');

  let body: ReactNode;
  if (query?.isPending) {
    body = Array.from({ length: skeletonRows }, (_, i) => (
      <tr key={`s${i}`} aria-busy="true">
        <td colSpan={columns.length}>
          <Skeleton className="h-4 w-full" />
        </td>
      </tr>
    ));
  } else if (query?.isError) {
    body = (
      <tr>
        <td colSpan={columns.length} className="py-8">
          <ErrorState error={query.error} onRetry={() => query.refetch()} />
        </td>
      </tr>
    );
  } else if (list.length === 0) {
    body = (
      <tr>
        <td colSpan={columns.length} className="py-10 text-center text-muted-foreground">
          <Inbox className="mx-auto mb-1.5 size-6 opacity-50" />
          {emptyMessage ?? t('common.noResults')}
        </td>
      </tr>
    );
  } else {
    body = list.map((row, index) => {
      const key = rowKey(row);
      return (
        <tr
          key={key}
          data-selected={selectedKey !== undefined && selectedKey === key ? 'true' : undefined}
          data-testid={rowTestId?.(row)}
          className={cn(onRowClick && 'cursor-pointer')}
          onClick={onRowClick ? () => onRowClick(row) : undefined}
        >
          {columns.map((c) => (
            <td key={c.key} className={cn(alignClass(c.align), c.wrap && 'whitespace-normal', c.className)}>
              {c.cell(row, index)}
            </td>
          ))}
        </tr>
      );
    });
  }

  return (
    <div>
      <div className="relative w-full overflow-auto" style={maxHeight ? { maxHeight } : undefined}>
        <table className="grid-table">
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c.key} className={alignClass(c.align)} style={c.width ? { width: c.width } : undefined}>
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>{body}</tbody>
        </table>
        {query?.isPending && <span className="sr-only">{t('common.loading')}</span>}
      </div>
      {pagination && !query?.isPending && <Pagination {...pagination} />}
    </div>
  );
}
