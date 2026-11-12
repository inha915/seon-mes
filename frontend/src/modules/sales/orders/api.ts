import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/shared/lib/api';
import { queryKeys } from '@/shared/lib/query';
import type { Paged, SalesOrderStatus } from '@/shared/types';
import type { SalesOrder, SalesOrderDetail } from '../types';

export interface SalesOrderQuery {
  q?: string;
  status?: SalesOrderStatus;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

export function useSalesOrders(query: SalesOrderQuery) {
  return useQuery({
    queryKey: [...queryKeys.salesOrders, 'list', query],
    queryFn: () => api.get<Paged<SalesOrder>>('/sales-orders', { ...query }),
    placeholderData: keepPreviousData,
  });
}

/** 출하·작업지시 화면의 수주 선택 목록 (출하 완료 제외) */
export function useOpenSalesOrders() {
  return useQuery({
    queryKey: [...queryKeys.salesOrders, 'open-options'],
    queryFn: () => api.get<Paged<SalesOrder>>('/sales-orders', { pageSize: 200 }),
    select: (d) => d.items.filter((o) => o.status !== 'SHIPPED'),
  });
}

export function useSalesOrder(id: number | undefined) {
  return useQuery({
    queryKey: [...queryKeys.salesOrders, 'detail', id],
    queryFn: () => api.get<SalesOrderDetail>(`/sales-orders/${id}`),
    enabled: id !== undefined && Number.isFinite(id),
  });
}

export interface SalesOrderInput {
  customerId: number;
  itemId: number;
  qty: number;
  orderDate: string;
  dueDate: string;
  note?: string;
}

export function useCreateSalesOrder() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: SalesOrderInput) => api.post<SalesOrder>('/sales-orders', input),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: queryKeys.salesOrders });
      void client.invalidateQueries({ queryKey: queryKeys.dashboard });
    },
  });
}
