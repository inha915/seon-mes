import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query';
import { api } from '@/shared/lib/api';
import { invalidateStockRelated, queryKeys } from '@/shared/lib/query';
import type { Paged } from '@/shared/types';
import type { Receipt } from '../types';

export interface ReceiptQuery {
  q?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

export function useReceipts(query: ReceiptQuery) {
  return useQuery({
    queryKey: [...queryKeys.receipts, query],
    queryFn: () => api.get<Paged<Receipt>>('/receipts', { ...query }),
    placeholderData: keepPreviousData,
  });
}

export interface ReceiptInput {
  partnerId: number;
  itemId: number;
  receiptDate: string;
  qty: number;
  supplierLotNo?: string;
  note?: string;
}

export function useCreateReceipt() {
  return useMutation({
    mutationFn: (input: ReceiptInput) => api.post<Receipt>('/receipts', input),
    // 입고 성공 → 입고 이력, 재고현황, 수불, 대시보드 등을 다시 조회
    onSuccess: () => invalidateStockRelated(),
  });
}
