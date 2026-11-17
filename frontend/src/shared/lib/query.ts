import { QueryClient } from '@tanstack/react-query'
import { ApiError } from './api'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      retry: (count, error) =>
        !(
          error instanceof ApiError &&
          error.status >= 400 &&
          error.status < 500
        ) && count < 2,
      refetchOnWindowFocus: false,
    },
  },
})

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
}

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
  )
}
