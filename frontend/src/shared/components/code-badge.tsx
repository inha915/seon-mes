import { Link } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Badge } from '@/shared/ui/badge'
import { codeKey, codeTone, type CodeGroup } from '@/shared/codes'
import { cn } from '@/shared/lib/utils'

export function CodeBadge({
  group,
  value,
  className,
}: {
  group: CodeGroup
  value: string
  className?: string
}) {
  const { t } = useTranslation()
  return (
    <Badge
      variant={codeTone(group, value)}
      className={className}
      data-code={value}
    >
      {t(codeKey(group, value), { defaultValue: value })}
    </Badge>
  )
}

export function useCodeLabel(group: CodeGroup) {
  const { t } = useTranslation()
  return (value: string) => t(codeKey(group, value), { defaultValue: value })
}

export function CodeText({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return <span className={cn('code-text', className)}>{children}</span>
}

export function ItemCell({ code, name }: { code: string; name: string }) {
  return (
    <div className="leading-tight">
      <div className="code-text">{code}</div>
      <div className="sub-text">{name}</div>
    </div>
  )
}

export function LotLink({
  lotNo,
  className,
}: {
  lotNo: string
  className?: string
}) {
  return (
    <Link
      to="/inventory/lot-trace"
      search={{ lotNo }}
      className={cn('code-link', className)}
    >
      {lotNo}
    </Link>
  )
}
