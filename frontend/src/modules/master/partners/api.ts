import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { api } from '@/shared/lib/api'
import { queryKeys } from '@/shared/lib/query'
import type { Paged, PartnerType } from '@/shared/types'
import type { Partner } from '../types'

export interface PartnerQuery {
  q?: string
  role?: 'SUPPLIER' | 'CUSTOMER'
  page?: number
  pageSize?: number
}

export function usePartners(query: PartnerQuery) {
  return useQuery({
    queryKey: [...queryKeys.partners, query],
    queryFn: () => api.get<Paged<Partner>>('/partners', { ...query }),
    placeholderData: keepPreviousData,
  })
}

export function usePartnerOptions(role?: 'SUPPLIER' | 'CUSTOMER') {
  return useQuery({
    queryKey: [...queryKeys.partners, 'options', role ?? 'ALL'],
    queryFn: () =>
      api.get<Paged<Partner>>('/partners', { role, pageSize: 500 }),
    select: (d) => d.items,
  })
}

export interface PartnerInput {
  code: string
  name: string
  type: PartnerType
  businessNo?: string
  contactName?: string
  phone?: string
}

export function useCreatePartner() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (input: PartnerInput) => api.post<Partner>('/partners', input),
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.partners }),
  })
}
