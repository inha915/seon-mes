import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/shared/lib/api';
import { invalidateStockRelated, queryKeys } from '@/shared/lib/query';
import type { ApprovalStatus, Paged } from '@/shared/types';
import type { Approval } from './types';

export interface ApprovalQuery {
  q?: string;
  status?: ApprovalStatus;
  page?: number;
  pageSize?: number;
}

export function useApprovals(query: ApprovalQuery) {
  return useQuery({
    queryKey: [...queryKeys.approvals, 'list', query],
    queryFn: () => api.get<Paged<Approval>>('/approvals', { ...query }),
    placeholderData: keepPreviousData,
  });
}

export function useApproval(id: number | null) {
  return useQuery({
    queryKey: [...queryKeys.approvals, 'detail', id],
    queryFn: () => api.get<Approval>(`/approvals/${id}`),
    enabled: id !== null,
  });
}

type Decision = 'approve' | 'reject' | 'cancel';

export function useDecideApproval() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, decision, comment }: { id: number; decision: Decision; comment?: string }) =>
      api.post<Approval>(`/approvals/${id}/${decision}`, { comment: comment || undefined }),
    // 승인은 확정 트랜잭션을 실행하므로 재고 관련 화면 전체를 다시 조회
    onSettled: () => {
      void invalidateStockRelated(client);
    },
  });
}
