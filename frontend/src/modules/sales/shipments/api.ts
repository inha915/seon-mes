import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query';
import { api } from '@/shared/lib/api';
import { invalidateStockRelated, queryKeys } from '@/shared/lib/query';
import type { Paged } from '@/shared/types';
import type { Shipment } from '../types';

export interface ShipmentQuery {
  q?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

export function useShipments(query: ShipmentQuery) {
  return useQuery({
    queryKey: [...queryKeys.shipments, query],
    queryFn: () => api.get<Paged<Shipment>>('/shipments', { ...query }),
    placeholderData: keepPreviousData,
  });
}

export interface ShipmentInput {
  salesOrderId: number;
  shipDate: string;
  note?: string;
  lines: { lotId: number; qty: number }[];
}

export function useCreateShipment() {
  return useMutation({
    mutationFn: (input: ShipmentInput) => api.post<Shipment>('/shipments', input),
    // 출하는 완제품 재고를 차감하므로 재고·수주·LOT 추적을 모두 다시 조회
    onSettled: () => invalidateStockRelated(),
  });
}
