import { z } from 'zod'

// 요청 검증에 반복해서 쓰는 스키마
export const zId = z.coerce.number().int().positive()
export const zDate = z.iso.date() // YYYY-MM-DD
export const zQty = z.coerce
  .number()
  .positive()
  .max(99_999_999_999)
  .transform((v) => Math.round(v * 1000) / 1000)
  .refine((v) => v > 0, { message: 'too_small' })
export const zOptionalText = z
  .string()
  .trim()
  .max(500)
  .optional()
  .transform((v) => (v ? v : null))

export const zPagination = {
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(500).default(20),
}

export const zOptionalQuery = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v : undefined))
