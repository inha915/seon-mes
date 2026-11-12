import { QueryClient } from '@tanstack/react-query';
import { ApiError } from './api';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      retry: (count, error) => !(error instanceof ApiError && error.status >= 400 && error.status < 500) && count < 2,
      refetchOnWindowFocus: false,
    },
  },
});

/** TanStack Query 키. 상위 키로 invalidate 하면 하위 목록/상세가 모두 다시 조회됩니다. */
export const queryKeys = {
  dashboard: ['dashboard'] as const,
  partners: ['partners'] as const,
  items: ['items'] as const,
  receipts: ['receipts'] as const,
  workOrders: ['work-orders'] as const,
  production: ['production-results'] as const,
  inventory: ['inventory'] as const,
  lots: ['lots'] as const,
  salesOrders: ['sales-orders'] as const,
  shipments: ['shipments'] as const,
  approvals: ['approvals'] as const,
  equipments: ['equipments'] as const,
  users: ['users'] as const,
  settings: ['settings'] as const,
};

/**
 * 재고에 영향을 주는 작업(입고, 생산실적 확정·결재 승인, 출하) 후 관련 화면 데이터를 다시 조회합니다.
 * 재고현황·수불·LOT 추적·작업지시·수주·결재함·대시보드·품목(현재고 컬럼)이 즉시 반영됩니다.
 */
export function invalidateStockRelated(client: QueryClient = queryClient) {
  return Promise.all(
    [
      queryKeys.inventory,
      queryKeys.lots,
      queryKeys.dashboard,
      queryKeys.receipts,
      queryKeys.workOrders,
      queryKeys.production,
      queryKeys.items,
      queryKeys.salesOrders,
      queryKeys.shipments,
      queryKeys.approvals,
    ].map((queryKey) => client.invalidateQueries({ queryKey })),
  );
}
