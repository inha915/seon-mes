import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/shared/lib/api';
import { queryKeys } from '@/shared/lib/query';
import type { Settings } from '../types';

export function useSettings() {
  return useQuery({ queryKey: queryKeys.settings, queryFn: () => api.get<Settings>('/settings') });
}

export function useUpdateSettings() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<Settings>) => api.put<Settings>('/settings', input),
    onSuccess: (data) => client.setQueryData(queryKeys.settings, data),
  });
}
