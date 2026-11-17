import { useMutation } from '@tanstack/react-query'
import { api } from '@/shared/lib/api'
import { invalidateStockRelated } from '@/shared/lib/query'
import type { Approval } from '../../approval/types'
import type { ProductionInput, ProductionResult } from '../types'

export function useConfirmProduction() {
  return useMutation({
    mutationFn: (input: ProductionInput) =>
      api.post<ProductionResult>('/production-results', input),
    // 실패해도 다른 요청이 재고를 바꿨을 수 있어서 다시 조회
    onSettled: () => invalidateStockRelated(),
  })
}

export function useRequestApproval() {
  return useMutation({
    mutationFn: (input: ProductionInput) =>
      api.post<Approval>('/approvals', input),
    onSettled: () => invalidateStockRelated(),
  })
}
