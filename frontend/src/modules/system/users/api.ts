import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/shared/lib/api';
import { queryKeys } from '@/shared/lib/query';
import type { Paged, UserRole } from '@/shared/types';
import type { User } from '../types';

export function useUsers(query: { q?: string; page?: number; pageSize?: number }) {
  return useQuery({
    queryKey: [...queryKeys.users, 'list', query],
    queryFn: () => api.get<Paged<User>>('/users', { ...query }),
    placeholderData: keepPreviousData,
  });
}

export function useCreateUser() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: { employeeNo: string; name: string; department: string; role: UserRole }) =>
      api.post<User>('/users', input),
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.users }),
  });
}

export function useUpdateUser() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: { id: number; role?: UserRole; active?: boolean }) => api.patch<User>(`/users/${id}`, input),
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.users }),
  });
}
