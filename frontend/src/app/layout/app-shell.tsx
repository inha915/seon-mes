import { Link, Outlet, useRouterState } from '@tanstack/react-router';
import { CalendarDays, ChevronRight } from 'lucide-react';
import { Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { LoadingBlock } from '@/shared/components/query-state';
import { useFormat } from '@/shared/lib/format';
import { todayLocal } from '@/shared/lib/utils';
import { findMenu } from '../menu';
import { LanguageSwitcher } from './language-switcher';
import { SideTree } from './side-tree';
import { UserSwitcher } from './user-switcher';

/** 앱 공통 틀: 좌측 트리 메뉴 + 상단 헤더(브레드크럼·사용자·언어) + 본문 */
export function AppShell() {
  const { t } = useTranslation();
  const fmt = useFormat();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { domain, module } = findMenu(pathname);

  return (
    <div className="flex min-h-screen min-w-[1200px]">
      <aside className="sticky top-0 flex h-screen w-60 shrink-0 flex-col bg-sidebar text-sidebar-foreground">
        <Link to="/" className="flex h-12 items-center gap-2 border-b border-sidebar-border px-4">
          <img src="/favicon.svg" alt="" className="size-6" />
          <div className="leading-tight">
            <div className="text-[13px] font-bold text-white">{t('app.company')}</div>
            <div className="text-[11px] text-sidebar-muted">{t('app.name')}</div>
          </div>
        </Link>
        <SideTree />
        <div className="border-t border-sidebar-border px-4 py-2.5 text-[11px] text-sidebar-muted">{t('app.demoNotice')}</div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-12 items-center justify-between border-b bg-card/95 px-5 backdrop-blur">
          <nav aria-label={t('nav.breadcrumb')} className="flex items-center gap-1.5 text-[13px]">
            <span className="text-muted-foreground">{t('app.name')}</span>
            {domain && (
              <>
                <ChevronRight className="size-3.5 text-muted-foreground/60" />
                <span className="text-muted-foreground">{t(domain.labelKey)}</span>
              </>
            )}
            {module && (
              <>
                <ChevronRight className="size-3.5 text-muted-foreground/60" />
                <span className="font-semibold" data-testid="breadcrumb-current">
                  {t(module.labelKey)}
                </span>
              </>
            )}
          </nav>
          <div className="flex items-center gap-2 text-[13px]">
            <span className="mr-1 flex items-center gap-1.5 text-muted-foreground">
              <CalendarDays className="size-4" />
              {fmt.date(todayLocal())}
            </span>
            <UserSwitcher />
            <LanguageSwitcher />
          </div>
        </header>
        <main className="flex-1 px-5 py-4">
          {/* 화면 모듈은 지연 로딩 — 내려받는 동안 스켈레톤 표시 */}
          <Suspense fallback={<LoadingBlock lines={8} />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  );
}
