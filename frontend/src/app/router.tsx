import { createRootRoute, createRoute, createRouter, Link } from '@tanstack/react-router';
import { lazy, type ComponentType } from 'react';
import { useTranslation } from 'react-i18next';
import type { StockTab } from '@/modules/inventory/stock/stock-page';
import { ErrorState } from '@/shared/components/query-state';
import { Button } from '@/shared/ui/button';
import { AppShell } from './layout/app-shell';

/**
 * 라우트 — 경로는 메뉴(app/menu.ts)의 대분류/모듈 구조와 같습니다.
 * 화면은 모듈 단위로 지연 로딩되어(코드 분할) 첫 화면에 필요한 코드만 내려받습니다.
 */
// 이름 있는 export 를 React.lazy 용 default 로 감쌉니다.
function lazyPage<M extends Record<string, unknown>, K extends keyof M & string>(loader: () => Promise<M>, name: K) {
  return lazy(async () => ({ default: (await loader())[name] as unknown as ComponentType<object> })) as unknown as M[K];
}
const ApprovalsPage = lazyPage(() => import('@/modules/approval/approvals-page'), 'ApprovalsPage');
const DashboardPage = lazyPage(() => import('@/modules/dashboard/dashboard-page'), 'DashboardPage');
const EquipmentDetailPage = lazyPage(() => import('@/modules/equipment/equipment-detail-page'), 'EquipmentDetailPage');
const EquipmentPage = lazyPage(() => import('@/modules/equipment/equipment-page'), 'EquipmentPage');
const LotTracePage = lazyPage(() => import('@/modules/inventory/lot-trace/lot-trace-page'), 'LotTracePage');
const ReceiptsPage = lazyPage(() => import('@/modules/inventory/receipts/receipts-page'), 'ReceiptsPage');
const StockPage = lazyPage(() => import('@/modules/inventory/stock/stock-page'), 'StockPage');
const ItemsPage = lazyPage(() => import('@/modules/master/items/items-page'), 'ItemsPage');
const PartnersPage = lazyPage(() => import('@/modules/master/partners/partners-page'), 'PartnersPage');
const ProductionPage = lazyPage(() => import('@/modules/production/results/production-page'), 'ProductionPage');
const WorkOrderDetailPage = lazyPage(() => import('@/modules/production/work-orders/work-order-detail-page'), 'WorkOrderDetailPage');
const WorkOrdersPage = lazyPage(() => import('@/modules/production/work-orders/work-orders-page'), 'WorkOrdersPage');
const SalesOrderDetailPage = lazyPage(() => import('@/modules/sales/orders/sales-order-detail-page'), 'SalesOrderDetailPage');
const SalesOrdersPage = lazyPage(() => import('@/modules/sales/orders/sales-orders-page'), 'SalesOrdersPage');
const ShipmentsPage = lazyPage(() => import('@/modules/sales/shipments/shipments-page'), 'ShipmentsPage');
const CodesPage = lazyPage(() => import('@/modules/system/codes/codes-page'), 'CodesPage');
const SettingsPage = lazyPage(() => import('@/modules/system/settings/settings-page'), 'SettingsPage');
const UsersPage = lazyPage(() => import('@/modules/system/users/users-page'), 'UsersPage');

function NotFound() {
  const { t } = useTranslation();
  return (
    <div className="panel mx-auto mt-10 max-w-md p-8 text-center">
      <p className="mb-3 text-[13px] text-muted-foreground">{t('common.pageNotFound')}</p>
      <Button asChild variant="outline">
        <Link to="/">{t('nav.dashboard')}</Link>
      </Button>
    </div>
  );
}

const rootRoute = createRootRoute({
  component: AppShell,
  notFoundComponent: NotFound,
  errorComponent: ({ error }) => (
    <div className="panel mx-auto mt-10 max-w-md p-8">
      <ErrorState error={error} />
    </div>
  ),
});

const positiveInt = (v: unknown) => {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : undefined;
};
/** 검색 파라미터·경로 파라미터가 없는 단순 화면 라우트 (경로 리터럴 타입을 유지하도록 제네릭) */
const page = <TPath extends string>(path: TPath, component: () => React.ReactNode) =>
  createRoute({ getParentRoute: () => rootRoute, path, component });

// 대시보드
const dashboardRoute = page('/', DashboardPage);

// 기준정보
const partnersRoute = page('/master/partners', PartnersPage);
const itemsRoute = page('/master/items', ItemsPage);

// 영업
const salesOrdersRoute = page('/sales/orders', SalesOrdersPage);
const salesOrderDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/sales/orders/$salesOrderId',
  component: function SalesOrderDetailRoute() {
    const { salesOrderId } = salesOrderDetailRoute.useParams();
    return <SalesOrderDetailPage salesOrderId={Number(salesOrderId)} />;
  },
});
const shipmentsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/sales/shipments',
  validateSearch: (s: Record<string, unknown>): { salesOrderId?: number } => ({ salesOrderId: positiveInt(s.salesOrderId) }),
  component: function ShipmentsRoute() {
    const { salesOrderId } = shipmentsRoute.useSearch();
    return <ShipmentsPage salesOrderId={salesOrderId} />;
  },
});

// 생산
const workOrdersRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/production/work-orders',
  validateSearch: (s: Record<string, unknown>): { salesOrderId?: number } => ({ salesOrderId: positiveInt(s.salesOrderId) }),
  component: function WorkOrdersRoute() {
    const { salesOrderId } = workOrdersRoute.useSearch();
    return <WorkOrdersPage key={salesOrderId ?? 0} salesOrderId={salesOrderId} />;
  },
});
const workOrderDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/production/work-orders/$workOrderId',
  component: function WorkOrderDetailRoute() {
    const { workOrderId } = workOrderDetailRoute.useParams();
    return <WorkOrderDetailPage workOrderId={Number(workOrderId)} />;
  },
});
const productionRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/production/results',
  validateSearch: (s: Record<string, unknown>): { workOrderId?: number } => ({ workOrderId: positiveInt(s.workOrderId) }),
  component: function ProductionRoute() {
    const { workOrderId } = productionRoute.useSearch();
    return <ProductionPage workOrderId={workOrderId} />;
  },
});

// 재고
const receiptsRoute = page('/inventory/receipts', ReceiptsPage);
const STOCK_TABS: StockTab[] = ['items', 'lots', 'transactions'];
const stockRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/inventory/stock',
  validateSearch: (s: Record<string, unknown>): { tab?: StockTab } => ({
    tab: STOCK_TABS.includes(s.tab as StockTab) ? (s.tab as StockTab) : undefined,
  }),
  component: function StockRoute() {
    const { tab } = stockRoute.useSearch();
    return <StockPage tab={tab ?? 'items'} />;
  },
});
const lotTraceRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/inventory/lot-trace',
  validateSearch: (s: Record<string, unknown>): { lotNo?: string } => ({
    lotNo: typeof s.lotNo === 'string' && s.lotNo.trim() ? s.lotNo.trim().toUpperCase() : undefined,
  }),
  component: function LotTraceRoute() {
    const { lotNo } = lotTraceRoute.useSearch();
    return <LotTracePage lotNo={lotNo} />;
  },
});

// 결재
const approvalsRoute = page('/approval/inbox', ApprovalsPage);

// 설비
const equipmentRoute = page('/equipment/equipments', EquipmentPage);
const equipmentDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/equipment/equipments/$equipmentId',
  component: function EquipmentDetailRoute() {
    const { equipmentId } = equipmentDetailRoute.useParams();
    return <EquipmentDetailPage equipmentId={Number(equipmentId)} />;
  },
});

// 시스템
const usersRoute = page('/system/users', UsersPage);
const settingsRoute = page('/system/settings', SettingsPage);
const codesRoute = page('/system/codes', CodesPage);

const routeTree = rootRoute.addChildren([
  dashboardRoute,
  partnersRoute,
  itemsRoute,
  salesOrdersRoute,
  salesOrderDetailRoute,
  shipmentsRoute,
  workOrdersRoute,
  workOrderDetailRoute,
  productionRoute,
  receiptsRoute,
  stockRoute,
  lotTraceRoute,
  approvalsRoute,
  equipmentRoute,
  equipmentDetailRoute,
  usersRoute,
  settingsRoute,
  codesRoute,
]);

export const router = createRouter({ routeTree, defaultPreload: 'intent' });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
