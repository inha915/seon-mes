import type { z } from 'zod'
import { AppError, ErrorCode } from '../lib/errors.js'

export function parse<T extends z.ZodType>(
  schema: T,
  data: unknown,
): z.output<T> {
  const result = schema.safeParse(data)
  if (result.success) return result.data

  throw new AppError(
    400,
    ErrorCode.VALIDATION_ERROR,
    'Request validation failed',
    {
      issues: result.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        code: issue.code,
        message: issue.message,
      })),
    },
  )
}
