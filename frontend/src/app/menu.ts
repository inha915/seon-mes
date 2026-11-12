import {
  BadgeCheck,
  Boxes,
  Building2,
  ClipboardList,
  Cog,
  Database,
  Factory,
  FileCheck2,
  GitBranch,
  LayoutDashboard,
  ListChecks,
  PackagePlus,
  Settings2,
  ShoppingCart,
  Truck,
  Users,
  Warehouse,
  Wrench,
  type LucideIcon,
} from 'lucide-react';

/**
 * 메뉴 트리 — 대분류(domain) › 모듈(module).
 * 좌측 트리 메뉴, 상단 브레드크럼, 라우트 경로가 모두 이 정의를 기준으로 합니다.
 * 새 화면을 추가할 때는 여기에 모듈을 등록하고 app/router.tsx 에 같은 경로의 라우트를 추가합니다.
 */
export interface MenuModule {
  to: string;
  labelKey: string;
  icon: LucideIcon;
  /** 메뉴 옆 건수 배지 */
  badge?: 'pendingApprovals';
}

export interface MenuDomain {
  id: string;
  labelKey: string;
  icon: LucideIcon;
  modules: MenuModule[];
}

export const DASHBOARD_MENU: MenuModule = { to: '/', labelKey: 'nav.dashboard', icon: LayoutDashboard };

export const MENU: MenuDomain[] = [
  {
    id: 'master',
    labelKey: 'nav.domains.master',
    icon: Database,
    modules: [
      { to: '/master/partners', labelKey: 'nav.partners', icon: Building2 },
      { to: '/master/items', labelKey: 'nav.items', icon: Boxes },
    ],
  },
  {
    id: 'sales',
    labelKey: 'nav.domains.sales',
    icon: ShoppingCart,
    modules: [
      { to: '/sales/orders', labelKey: 'nav.salesOrders', icon: ClipboardList },
      { to: '/sales/shipments', labelKey: 'nav.shipments', icon: Truck },
    ],
  },
  {
    id: 'production',
    labelKey: 'nav.domains.production',
    icon: Factory,
    modules: [
      { to: '/production/work-orders', labelKey: 'nav.workOrders', icon: ListChecks },
      { to: '/production/results', labelKey: 'nav.production', icon: Factory },
    ],
  },
  {
    id: 'inventory',
    labelKey: 'nav.domains.inventory',
    icon: Warehouse,
    modules: [
      { to: '/inventory/receipts', labelKey: 'nav.receipts', icon: PackagePlus },
      { to: '/inventory/stock', labelKey: 'nav.inventory', icon: Warehouse },
      { to: '/inventory/lot-trace', labelKey: 'nav.lotTrace', icon: GitBranch },
    ],
  },
  {
    id: 'approval',
    labelKey: 'nav.domains.approval',
    icon: FileCheck2,
    modules: [{ to: '/approval/inbox', labelKey: 'nav.approvals', icon: BadgeCheck, badge: 'pendingApprovals' }],
  },
  {
    id: 'equipment',
    labelKey: 'nav.domains.equipment',
    icon: Wrench,
    modules: [{ to: '/equipment/equipments', labelKey: 'nav.equipments', icon: Cog }],
  },
  {
    id: 'system',
    labelKey: 'nav.domains.system',
    icon: Settings2,
    modules: [
      { to: '/system/users', labelKey: 'nav.users', icon: Users },
      { to: '/system/settings', labelKey: 'nav.settings', icon: Settings2 },
      { to: '/system/codes', labelKey: 'nav.codes', icon: Database },
    ],
  },
];

export const isActivePath = (pathname: string, to: string) =>
  to === '/' ? pathname === '/' : pathname === to || pathname.startsWith(`${to}/`);

/** 현재 경로의 대분류·모듈 (브레드크럼, 트리 자동 펼침용) */
export function findMenu(pathname: string): { domain?: MenuDomain; module?: MenuModule } {
  if (pathname === '/') return { module: DASHBOARD_MENU };
  for (const domain of MENU) {
    const module = domain.modules.find((m) => isActivePath(pathname, m.to));
    if (module) return { domain, module };
  }
  return {};
}
