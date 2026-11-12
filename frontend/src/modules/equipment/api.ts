import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/shared/lib/api';
import { queryKeys } from '@/shared/lib/query';
import type { EquipmentLogType, EquipmentProcess, EquipmentStatus, Paged } from '@/shared/types';
import type { Equipment, EquipmentDetail } from './types';

export interface EquipmentQuery {
  q?: string;
  process?: EquipmentProcess;
  status?: EquipmentStatus;
  page?: number;
  pageSize?: number;
}

export function useEquipments(query: EquipmentQuery) {
  return useQuery({
    queryKey: [...queryKeys.equipments, 'list', query],
    queryFn: () => api.get<Paged<Equipment>>('/equipments', { ...query }),
    placeholderData: keepPreviousData,
  });
}

/** 작업지시 화면의 설비 선택 목록 */
export function useEquipmentOptions() {
  return useQuery({
    queryKey: [...queryKeys.equipments, 'options'],
    queryFn: () => api.get<Paged<Equipment>>('/equipments', { pageSize: 200 }),
    select: (d) => d.items,
  });
}

export function useEquipment(id: number) {
  return useQuery({
    queryKey: [...queryKeys.equipments, 'detail', id],
    queryFn: () => api.get<EquipmentDetail>(`/equipments/${id}`),
  });
}

export interface EquipmentInput {
  code: string;
  name: string;
  process: EquipmentProcess;
  status: EquipmentStatus;
  location?: string;
  installedAt?: string | null;
  note?: string;
}

export function useCreateEquipment() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: EquipmentInput) => api.post<EquipmentDetail>('/equipments', input),
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.equipments }),
  });
}

export function useAddEquipmentLog(id: number) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: { type: EquipmentLogType; toStatus?: EquipmentStatus; note?: string }) =>
      api.post<EquipmentDetail>(`/equipments/${id}/logs`, input),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: queryKeys.equipments });
      void client.invalidateQueries({ queryKey: queryKeys.dashboard });
    },
  });
}
