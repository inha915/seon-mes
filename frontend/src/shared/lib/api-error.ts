import type { TFunction } from 'i18next'
import { ApiError } from './api'

export function apiErrorMessage(t: TFunction, error: unknown): string {
  if (error instanceof ApiError) {
    const key = `errors.${error.code}`
    const details = (error.details ?? {}) as Record<string, unknown>
    if (error.code === 'INVALID_BOM' && typeof details.reason === 'string') {
      return t(`errors.INVALID_BOM_REASON.${details.reason}`, {
        ...details,
        defaultValue: t('errors.INVALID_BOM'),
      })
    }
    if (error.code === 'NOT_FOUND' && typeof details.resource === 'string') {
      return t('errors.NOT_FOUND', {
        resource: t(`resources.${details.resource}`, {
          defaultValue: details.resource,
        }),
      })
    }
    if (error.code === 'VALIDATION_ERROR' && Array.isArray(details.issues)) {
      const fields = (details.issues as { path: string }[])
        .map((i) =>
          t(`fields.${i.path.split('.')[0]}`, { defaultValue: i.path }),
        )
        .filter((v, idx, arr) => arr.indexOf(v) === idx)
        .join(', ')
      return t('errors.VALIDATION_ERROR_FIELDS', { fields })
    }
    return t(key, { ...details, defaultValue: t('errors.UNKNOWN') })
  }
  return t('errors.UNKNOWN')
}
