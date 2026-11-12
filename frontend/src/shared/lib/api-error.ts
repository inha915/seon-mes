import type { TFunction } from 'i18next';
import { ApiError } from './api';

/**
 * API 오류 코드 → 번역 문구. 코드별 문구는 locales/*.json 의 errors.* 에 있습니다.
 * details 의 값(LOT 번호, 품번 등)은 번역 문구의 {{변수}} 로 그대로 전달합니다.
 */
export function apiErrorMessage(t: TFunction, error: unknown): string {
  if (error instanceof ApiError) {
    const key = `errors.${error.code}`;
    const details = (error.details ?? {}) as Record<string, unknown>;
    if (error.code === 'INVALID_BOM' && typeof details.reason === 'string') {
      return t(`errors.INVALID_BOM_REASON.${details.reason}`, { ...details, defaultValue: t('errors.INVALID_BOM') });
    }
    if (error.code === 'NOT_FOUND' && typeof details.resource === 'string') {
      return t('errors.NOT_FOUND', { resource: t(`resources.${details.resource}`, { defaultValue: details.resource }) });
    }
    if (error.code === 'VALIDATION_ERROR' && Array.isArray(details.issues)) {
      const fields = (details.issues as { path: string }[])
        .map((i) => t(`fields.${i.path.split('.')[0]}`, { defaultValue: i.path }))
        .filter((v, idx, arr) => arr.indexOf(v) === idx)
        .join(', ');
      return t('errors.VALIDATION_ERROR_FIELDS', { fields });
    }
    return t(key, { ...details, defaultValue: t('errors.UNKNOWN') });
  }
  return t('errors.UNKNOWN');
}
