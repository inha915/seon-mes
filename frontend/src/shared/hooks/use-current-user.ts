import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { api } from '@/shared/lib/api';
import { getCurrentUserId, setCurrentUserId, subscribeCurrentUser } from '@/shared/lib/current-user';
import { queryKeys } from '@/shared/lib/query';
import type { Paged, UserRole } from '@/shared/types';

export interface UserOption {
  id: number;
  employeeNo: string;
  name: string;
  department: string;
  role: UserRole;
  active: boolean;
}

export const APPROVER_ROLES: UserRole[] = ['MANAGER', 'ADMIN'];

/**
 * 현재 사용자 (데모용 사용자 전환). 저장된 사용자가 없으면 첫 번째 활성 사용자를 선택합니다.
 * 사용자를 바꾸면 권한에 따라 달라지는 화면 데이터를 다시 조회합니다.
 */
export function useCurrentUser() {
  const client = useQueryClient();
  const userId = useSyncExternalStore(subscribeCurrentUser, getCurrentUserId);
  const users = useQuery({
    queryKey: [...queryKeys.users, 'active-options'],
    queryFn: () => api.get<Paged<UserOption>>('/users', { activeOnly: true, pageSize: 100 }),
    select: (d) => d.items,
    staleTime: 60_000,
  });

  useEffect(() => {
    const list = users.data;
    if (!list || list.length === 0) return;
    if (!userId || !list.some((u) => u.id === userId)) setCurrentUserId(list[0]!.id);
  }, [users.data, userId]);

  const switchUser = useCallback(
    (id: number) => {
      setCurrentUserId(id);
      void client.invalidateQueries();
    },
    [client],
  );

  const user = users.data?.find((u) => u.id === userId) ?? null;
  return {
    user,
    users: users.data ?? [],
    switchUser,
    isApprover: !!user && APPROVER_ROLES.includes(user.role),
    isAdmin: user?.role === 'ADMIN',
  };
}
