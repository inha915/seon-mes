import { useMutation } from '@tanstack/react-query';
import { api } from '@/shared/lib/api';
import { invalidateStockRelated } from '@/shared/lib/query';
import type { Approval } from '../../approval/types';
import type { ProductionInput, ProductionResult } from '../types';

/** 직접 확정 (시스템 설정에서 생산실적 결재를 끈 경우) */
export function useConfirmProduction() {
  return useMutation({
    mutationFn: (input: ProductionInput) => api.post<ProductionResult>('/production-results', input),
    // 성공·실패 모두 재고가 바뀌었을 수 있으므로(동시 차감) 관련 데이터를 다시 조회합니다.
    onSettled: () => invalidateStockRelated(),
  });
}

/** 결재 요청 (생산실적 결재 사용 시) — 승인되면 확정 트랜잭션이 실행됩니다. */
export function useRequestApproval() {
  return useMutation({
    mutationFn: (input: ProductionInput) => api.post<Approval>('/approvals', input),
    onSettled: () => invalidateStockRelated(),
  });
}
