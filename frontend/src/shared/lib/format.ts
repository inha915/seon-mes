import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { localeOf } from '@/i18n'

export function useFormat() {
  const { i18n } = useTranslation()
  const locale = localeOf(i18n.resolvedLanguage ?? i18n.language)

  return useMemo(() => {
    const numberFmt = new Intl.NumberFormat(locale, {
      maximumFractionDigits: 3,
    })
    const percentFmt = new Intl.NumberFormat(locale, {
      maximumFractionDigits: 1,
    })
    // DATE 컬럼은 UTC 기준으로 포맷해야 하루 밀리지 않음
    const dateFmt = new Intl.DateTimeFormat(locale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC',
    })
    const dateTimeFmt = new Intl.DateTimeFormat(locale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
    return {
      locale,
      number: (n: number | null | undefined) =>
        n == null ? '-' : numberFmt.format(n),
      signed: (n: number) =>
        n > 0 ? `+${numberFmt.format(n)}` : numberFmt.format(n),
      percent: (n: number | null | undefined) =>
        n == null ? '-' : `${percentFmt.format(n)}%`,
      date: (s: string | null | undefined) =>
        s ? dateFmt.format(new Date(`${s.slice(0, 10)}T00:00:00Z`)) : '-',
      dateTime: (s: string | null | undefined) =>
        s ? dateTimeFmt.format(new Date(s)) : '-',
    }
  }, [locale])
}
