import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/shared/lib/api';
import { queryKeys } from '@/shared/lib/query';
import type { ItemType, Paged, UnitCode } from '@/shared/types';
import type { Item } from '../types';

export const UNIT_CODES: UnitCode[] = ['EA', 'SHEET', 'KG', 'M', 'SET'];

export interface ItemQuery {
  q?: string;
  type?: ItemType;
  page?: number;
  pageSize?: number;
}

export function useItems(query: ItemQuery) {
  return useQuery({
    queryKey: [...queryKeys.items, query],
    queryFn: () => api.get<Paged<Item>>('/items', { ...query }),
    placeholderData: keepPreviousData,
  });
}

export function useItemOptions(type?: ItemType) {
  return useQuery({
    queryKey: [...queryKeys.items, 'options', type ?? 'ALL'],
    queryFn: () => api.get<Paged<Item>>('/items', { type, pageSize: 500 }),
    select: (d) => d.items,
  });
}

export interface ItemInput {
  code: string;
  name: string;
  type: ItemType;
  unit: UnitCode;
  spec?: string;
  bomLines?: { componentId: number; qtyPer: number }[];
}

export function useCreateItem() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: ItemInput) => api.post<Item>('/items', input),
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.items }),
  });
}

export function useReplaceBom() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ itemId, lines }: { itemId: number; lines: { componentId: number; qtyPer: number }[] }) =>
      api.put<Item>(`/items/${itemId}/bom`, { lines }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: queryKeys.items });
      void client.invalidateQueries({ queryKey: queryKeys.workOrders });
    },
  });
}
