import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/shared/ui/button';
import { useFormat } from '@/shared/lib/format';

export function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}) {
  const { t } = useTranslation();
  const fmt = useFormat();
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="flex items-center justify-between border-t px-3 py-2 text-[12.5px] text-muted-foreground">
      <span>{t('common.totalCount', { count: total, formatted: fmt.number(total) })}</span>
      <div className="flex items-center gap-1">
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)} aria-label={t('common.prev')}>
          <ChevronLeft />
        </Button>
        <span className="min-w-16 text-center tabular-nums">
          {fmt.number(page)} / {fmt.number(pageCount)}
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={page >= pageCount}
          onClick={() => onPageChange(page + 1)}
          aria-label={t('common.next')}
        >
          <ChevronRight />
        </Button>
      </div>
    </div>
  );
}
