import { z } from 'zod';
import { AppError, ErrorCode } from './errors.js';

/** Zod 스키마로 요청값을 검증하고, 실패 시 VALIDATION_ERROR 로 변환합니다. */
export function parse<T extends z.ZodType>(schema: T, data: unknown): z.output<T> {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'Request validation failed', {
      issues: result.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        code: issue.code,
        message: issue.message,
      })),
    });
  }
  return result.data;
}

/** 공통 스키마 조각 */
export const zId = z.coerce.number().int().positive();
export const zDate = z.iso.date(); // YYYY-MM-DD
/** 수량: 양수, 소수 3자리로 반올림 (DB NUMERIC(14,3)) */
export const zQty = z.coerce
  .number()
  .positive()
  .max(99_999_999_999)
  .transform((v) => Math.round(v * 1000) / 1000)
  .refine((v) => v > 0, { message: 'too_small' });
export const zOptionalText = z
  .string()
  .trim()
  .max(500)
  .optional()
  .transform((v) => (v ? v : null));

export const zPagination = {
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(500).default(20),
};

/** 빈 문자열 쿼리 파라미터를 undefined 로 취급 */
export const zOptionalQuery = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v : undefined));
