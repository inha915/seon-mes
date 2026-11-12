import { RotateCcw, Search } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/shared/ui/button';
import { cn } from '@/shared/lib/utils';

/**
 * 조회조건 패널 — 그리드 위에 놓는 검색 영역. Enter 또는 [조회]로 onSearch, [초기화]로 onReset.
 * 조건 값은 화면이 상태로 관리하고, 조회 버튼을 눌렀을 때만 적용합니다(ERP 관례).
 */
export function SearchPanel({
  onSearch,
  onReset,
  children,
  className,
}: {
  onSearch: () => void;
  onReset?: () => void;
  children: ReactNode;
  className?: string;
}) {
  const { t } = useTranslation();
  return (
    <form
      role="search"
      className={cn('search-panel', className)}
      onSubmit={(e) => {
        e.preventDefault();
        onSearch();
      }}
    >
      {children}
      <div className="ml-auto flex items-center gap-1.5">
        <Button type="submit" variant="default">
          <Search /> {t('common.search')}
        </Button>
        {onReset && (
          <Button type="button" variant="outline" onClick={onReset}>
            <RotateCcw /> {t('common.reset')}
          </Button>
        )}
      </div>
    </form>
  );
}

export function SearchField({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={cn('search-field', className)}>
      <span className="field-label">{label}</span>
      {children}
    </label>
  );
}

/** 기간 조건 (시작일 ~ 종료일) */
export function DateRangeField({
  label,
  from,
  to,
  onChange,
}: {
  label: string;
  from: string;
  to: string;
  onChange: (range: { from: string; to: string }) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="search-field">
      <span className="field-label">{label}</span>
      <div className="flex items-center gap-1.5">
        <input
          type="date"
          aria-label={t('common.from')}
          value={from}
          onChange={(e) => onChange({ from: e.target.value, to })}
          className="h-8 w-36 rounded-md border border-input bg-card px-2 text-sm shadow-xs outline-none focus-visible:border-ring"
        />
        <span className="text-muted-foreground">~</span>
        <input
          type="date"
          aria-label={t('common.to')}
          value={to}
          onChange={(e) => onChange({ from, to: e.target.value })}
          className="h-8 w-36 rounded-md border border-input bg-card px-2 text-sm shadow-xs outline-none focus-visible:border-ring"
        />
      </div>
    </div>
  );
}
