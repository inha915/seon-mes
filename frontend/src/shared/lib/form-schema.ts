import { z } from 'zod'

export const requiredText = (max = 100) =>
  z
    .string()
    .trim()
    .min(1, { error: 'validation.required' })
    .max(max, { error: 'validation.maxLength' })

export const optionalText = (max = 500) =>
  z.string().trim().max(max, { error: 'validation.maxLength' })

export const codeText = () =>
  requiredText(30).regex(/^[A-Za-z0-9_.-]+$/, {
    error: 'validation.codeFormat',
  })

const numeric = () =>
  z
    .string()
    .trim()
    .min(1, { error: 'validation.required' })
    .refine((v) => v !== '' && Number.isFinite(Number(v)), {
      error: 'validation.number',
    })
    .transform(Number)

export const positiveNumber = () =>
  numeric()
    .refine((v) => v > 0, { error: 'validation.positive' })
    .refine((v) => Math.abs(Math.round(v * 1000) - v * 1000) < 1e-6, {
      error: 'validation.decimal3',
    })

export const positiveInt = () =>
  numeric()
    .refine((v) => Number.isInteger(v), { error: 'validation.integer' })
    .refine((v) => v > 0, { error: 'validation.positive' })

export const nonNegativeInt = () =>
  numeric()
    .refine((v) => Number.isInteger(v), { error: 'validation.integer' })
    .refine((v) => v >= 0, { error: 'validation.nonNegative' })

export const requiredSelect = () =>
  z.string().min(1, { error: 'validation.selectRequired' }).transform(Number)

export const requiredDate = () =>
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { error: 'validation.date' })
