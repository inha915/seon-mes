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
} from 'lucide-react'

export interface MenuModule {
  to: string
  labelKey: string
  icon: LucideIcon
  badge?: 'pendingApprovals'
}

export interface MenuDomain {
  id: string
  labelKey: string
  icon: LucideIcon
  modules: MenuModule[]
}

export const DASHBOARD_MENU: MenuModule = {
  to: '/',
  labelKey: 'nav.dashboard',
  icon: LayoutDashboard,
}

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
      {
        to: '/production/work-orders',
        labelKey: 'nav.workOrders',
        icon: ListChecks,
      },
      { to: '/production/results', labelKey: 'nav.production', icon: Factory },
    ],
  },
  {
    id: 'inventory',
    labelKey: 'nav.domains.inventory',
    icon: Warehouse,
    modules: [
      {
        to: '/inventory/receipts',
        labelKey: 'nav.receipts',
        icon: PackagePlus,
      },
      { to: '/inventory/stock', labelKey: 'nav.inventory', icon: Warehouse },
      { to: '/inventory/lot-trace', labelKey: 'nav.lotTrace', icon: GitBranch },
    ],
  },
  {
    id: 'approval',
    labelKey: 'nav.domains.approval',
    icon: FileCheck2,
    modules: [
      {
        to: '/approval/inbox',
        labelKey: 'nav.approvals',
        icon: BadgeCheck,
        badge: 'pendingApprovals',
      },
    ],
  },
  {
    id: 'equipment',
    labelKey: 'nav.domains.equipment',
    icon: Wrench,
    modules: [
      { to: '/equipment/equipments', labelKey: 'nav.equipments', icon: Cog },
    ],
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
]

export const isActivePath = (pathname: string, to: string) =>
  to === '/'
    ? pathname === '/'
    : pathname === to || pathname.startsWith(`${to}/`)

export function findMenu(pathname: string): {
  domain?: MenuDomain
  module?: MenuModule
} {
  if (pathname === '/') return { module: DASHBOARD_MENU }
  for (const domain of MENU) {
    const module = domain.modules.find((m) => isActivePath(pathname, m.to))
    if (module) return { domain, module }
  }
  return {}
}
