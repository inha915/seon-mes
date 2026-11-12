import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api } from '@/shared/lib/api';
import { queryKeys } from '@/shared/lib/query';
import type { InventoryTxType, ItemType, Paged } from '@/shared/types';
import type { InventoryTransaction, ItemStock, LotStock, LotTrace } from '../types';

export interface StockFilter {
  q?: string;
  lotNo?: string;
  type?: ItemType;
  from?: string;
  to?: string;
  includeEmpty?: boolean;
  txType?: InventoryTxType;
  page?: number;
  pageSize?: number;
}

export function useItemStock(f: StockFilter) {
  return useQuery({
    queryKey: [...queryKeys.inventory, 'items', f],
    queryFn: () => api.get<Paged<ItemStock>>('/inventory/items', { q: f.q, type: f.type, page: f.page, pageSize: f.pageSize }),
    placeholderData: keepPreviousData,
  });
}

export function useLotStock(f: StockFilter) {
  return useQuery({
    queryKey: [...queryKeys.inventory, 'lots', f],
    queryFn: () =>
      api.get<Paged<LotStock>>('/inventory/lots', {
        q: f.q,
        lotNo: f.lotNo,
        type: f.type,
        from: f.from,
        to: f.to,
        includeEmpty: f.includeEmpty,
        page: f.page,
        pageSize: f.pageSize,
      }),
    placeholderData: keepPreviousData,
  });
}

export function useTransactions(f: StockFilter) {
  return useQuery({
    queryKey: [...queryKeys.inventory, 'transactions', f],
    queryFn: () =>
      api.get<Paged<InventoryTransaction>>('/inventory/transactions', {
        q: f.q,
        lotNo: f.lotNo,
        type: f.txType,
        from: f.from,
        to: f.to,
        page: f.page,
        pageSize: f.pageSize,
      }),
    placeholderData: keepPreviousData,
  });
}

export function useLotTrace(lotNo: string | undefined) {
  return useQuery({
    queryKey: [...queryKeys.lots, lotNo],
    queryFn: () => api.get<LotTrace>(`/lots/${encodeURIComponent(lotNo!)}`),
    enabled: !!lotNo,
  });
}
