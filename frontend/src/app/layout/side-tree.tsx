import { useQuery } from '@tanstack/react-query';
import { Link, useRouterState } from '@tanstack/react-router';
import { ChevronRight, Search } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '@/shared/lib/api';
import { queryKeys } from '@/shared/lib/query';
import { cn } from '@/shared/lib/utils';
import type { Paged } from '@/shared/types';
import { DASHBOARD_MENU, findMenu, isActivePath, MENU, type MenuModule } from '../menu';

const EXPANDED_KEY = 'seon-mes.menu.expanded';

function readExpanded(): Set<string> {
  try {
    const raw = localStorage.getItem(EXPANDED_KEY);
    if (raw) return new Set(JSON.parse(raw) as string[]);
  } catch {
    /* 기본값 사용 */
  }
  return new Set(MENU.map((d) => d.id));
}

/**
 * 좌측 트리 메뉴 — 대분류를 접고 펼치며, 펼침 상태는 브라우저에 저장합니다.
 * 현재 화면의 대분류는 자동으로 펼치고, 메뉴 검색어가 있으면 일치하는 모듈만 보여줍니다.
 */
export function SideTree() {
  const { t } = useTranslation();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [expanded, setExpanded] = useState(readExpanded);
  const [keyword, setKeyword] = useState('');
  const activeDomain = findMenu(pathname).domain?.id;

  const pendingApprovals = useQuery({
    queryKey: [...queryKeys.approvals, 'pending-count'],
    queryFn: () => api.get<Paged<unknown>>('/approvals', { status: 'PENDING', pageSize: 1 }),
    select: (d) => d.total,
    refetchInterval: 30_000,
  });

  // 현재 화면의 대분류는 항상 펼침
  useEffect(() => {
    if (activeDomain) setExpanded((prev) => (prev.has(activeDomain) ? prev : new Set(prev).add(activeDomain)));
  }, [activeDomain]);

  useEffect(() => {
    try {
      localStorage.setItem(EXPANDED_KEY, JSON.stringify([...expanded]));
    } catch {
      /* 무시 */
    }
  }, [expanded]);

  const filter = keyword.trim().toLowerCase();
  const domains = useMemo(
    () =>
      MENU.map((d) => ({
        ...d,
        modules: filter
          ? d.modules.filter((m) => t(m.labelKey).toLowerCase().includes(filter) || t(d.labelKey).toLowerCase().includes(filter))
          : d.modules,
      })).filter((d) => d.modules.length > 0),
    [filter, t],
  );

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const badgeValue = (m: MenuModule) => (m.badge === 'pendingApprovals' ? pendingApprovals.data : undefined);

  return (
    <nav className="flex min-h-0 flex-1 flex-col" aria-label={t('nav.label')}>
      <div className="px-3 pb-2 pt-3">
        <label className="flex items-center gap-1.5 rounded-md bg-sidebar-accent/70 px-2 py-1.5 text-[12.5px]">
          <Search className="size-3.5 text-sidebar-muted" />
          <input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder={t('nav.search')}
            aria-label={t('nav.search')}
            className="w-full bg-transparent text-sidebar-foreground outline-none placeholder:text-sidebar-muted"
          />
        </label>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        {!filter && <TreeLink module={DASHBOARD_MENU} active={pathname === '/'} depth={0} />}
        {domains.map((domain) => {
          const open = !!filter || expanded.has(domain.id);
          const hasActive = domain.id === activeDomain;
          return (
            <div key={domain.id} className="mt-1">
              <button
                type="button"
                onClick={() => toggle(domain.id)}
                aria-expanded={open}
                data-testid={`menu-domain-${domain.id}`}
                className={cn(
                  'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-[13px] font-semibold transition-colors hover:bg-sidebar-accent',
                  hasActive ? 'text-white' : 'text-sidebar-foreground',
                )}
              >
                <ChevronRight className={cn('size-3.5 text-sidebar-muted transition-transform', open && 'rotate-90')} />
                <domain.icon className="size-4 opacity-80" />
                <span className="flex-1 text-left">{t(domain.labelKey)}</span>
              </button>
              {open && (
                <div className="ml-[13px] border-l border-sidebar-border pl-1.5">
                  {domain.modules.map((m) => (
                    <TreeLink key={m.to} module={m} active={isActivePath(pathname, m.to)} depth={1} badge={badgeValue(m)} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
        {filter && domains.length === 0 && <p className="px-2 py-3 text-[12px] text-sidebar-muted">{t('nav.noMatch')}</p>}
      </div>
    </nav>
  );
}

function TreeLink({ module, active, depth, badge }: { module: MenuModule; active: boolean; depth: 0 | 1; badge?: number }) {
  const { t } = useTranslation();
  return (
    <Link
      to={module.to}
      className={cn(
        'relative flex items-center gap-2 rounded-md px-2 py-1.5 text-[13px] text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-white',
        depth === 0 && 'font-semibold',
        active && 'bg-sidebar-accent font-semibold text-white before:absolute before:inset-y-1 before:left-0 before:w-0.5 before:rounded before:bg-sidebar-active',
      )}
    >
      <module.icon className="size-4 opacity-75" />
      <span className="flex-1">{t(module.labelKey)}</span>
      {!!badge && (
        <span className="min-w-5 rounded-full bg-warning px-1.5 text-center text-[11px] font-bold leading-5 text-black/80" data-testid="menu-badge">
          {badge}
        </span>
      )}
    </Link>
  );
}
