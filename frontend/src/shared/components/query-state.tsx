import { AlertTriangle, Inbox, RotateCw } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/shared/ui/button';
import { Skeleton } from '@/shared/ui/skeleton';
import { apiErrorMessage } from '@/shared/lib/api-error';

/** 조회 실패 — 번역된 오류 문구와 다시 시도 버튼 */
export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const { t } = useTranslation();
  return (
    <div role="alert" className="flex flex-col items-center gap-2 text-center text-[13px]">
      <AlertTriangle className="size-6 text-destructive" />
      <p className="font-medium">{t('common.loadError')}</p>
      <p className="text-muted-foreground">{apiErrorMessage(t, error)}</p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RotateCw /> {t('common.retry')}
        </Button>
      )}
    </div>
  );
}

/** 상세 영역 로딩 */
export function LoadingBlock({ lines = 4 }: { lines?: number }) {
  const { t } = useTranslation();
  return (
    <div className="space-y-2" aria-busy="true" aria-label={t('common.loading')}>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} className="h-5 w-full" />
      ))}
    </div>
  );
}

/** 빈 상태 (선택 전 안내 등) */
export function EmptyState({ icon, children }: { icon?: ReactNode; children: ReactNode }) {
  return (
    <div className="py-14 text-center text-[13px] text-muted-foreground [&_svg]:mx-auto [&_svg]:mb-2 [&_svg]:size-8 [&_svg]:opacity-40">
      {icon ?? <Inbox />}
      {children}
    </div>
  );
}

/** 상세 조회 상태 분기: 로딩 → 오류 → 내용 */
export function QueryBoundary<T>({
  query,
  children,
  lines,
}: {
  query: { isPending: boolean; isError: boolean; error: unknown; data: T | undefined; refetch: () => unknown };
  children: (data: T) => ReactNode;
  lines?: number;
}) {
  if (query.isPending) return <LoadingBlock lines={lines} />;
  if (query.isError || query.data === undefined)
    return (
      <div className="py-8">
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      </div>
    );
  return <>{children(query.data)}</>;
}

/** 저장 실패 알림 */
export function FormErrorAlert({ error }: { error: unknown }) {
  const { t } = useTranslation();
  if (!error) return null;
  return (
    <div
      role="alert"
      className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-[13px] text-destructive"
    >
      <AlertTriangle className="mt-0.5 size-4 shrink-0" />
      <div>
        <p className="font-medium">{t('common.saveFailed')}</p>
        <p>{apiErrorMessage(t, error)}</p>
      </div>
    </div>
  );
}
