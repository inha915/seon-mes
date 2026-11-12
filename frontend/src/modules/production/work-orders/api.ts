import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/shared/lib/api';
import { queryKeys } from '@/shared/lib/query';
import type { Paged, WorkOrderStatus } from '@/shared/types';
import type { WorkOrder, WorkOrderDetail } from '../types';

export interface WorkOrderQuery {
  q?: string;
  status?: WorkOrderStatus;
  page?: number;
  pageSize?: number;
}

export function useWorkOrders(query: WorkOrderQuery) {
  return useQuery({
    queryKey: [...queryKeys.workOrders, 'list', query],
    queryFn: () => api.get<Paged<WorkOrder>>('/work-orders', { ...query }),
    placeholderData: keepPreviousData,
  });
}

export function useWorkOrder(id: number | undefined) {
  return useQuery({
    queryKey: [...queryKeys.workOrders, 'detail', id],
    queryFn: () => api.get<WorkOrderDetail>(`/work-orders/${id}`),
    enabled: id !== undefined && Number.isFinite(id),
  });
}

export interface WorkOrderInput {
  itemId: number;
  plannedQty: number;
  workDate: string;
  salesOrderId?: number | null;
  equipmentId?: number | null;
  note?: string;
}

export function useCreateWorkOrder() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: WorkOrderInput) => api.post<WorkOrder>('/work-orders', input),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: queryKeys.workOrders });
      void client.invalidateQueries({ queryKey: queryKeys.dashboard });
      void client.invalidateQueries({ queryKey: queryKeys.salesOrders });
      void client.invalidateQueries({ queryKey: queryKeys.equipments });
    },
  });
}
