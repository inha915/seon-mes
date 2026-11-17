import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Label } from '@/shared/ui/label'
import { cn } from '@/shared/lib/utils'

export function FormField({
  label,
  htmlFor,
  error,
  required,
  hint,
  className,
  children,
}: {
  label: string
  htmlFor?: string
  error?: string
  required?: boolean
  hint?: ReactNode
  className?: string
  children: ReactNode
}) {
  const { t } = useTranslation()
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <Label htmlFor={htmlFor} className="field-label">
        {label}
        {required && <span className="text-destructive">*</span>}
      </Label>
      {children}
      {error ? (
        <p role="alert" className="text-[12px] text-destructive">
          {t(error)}
        </p>
      ) : hint ? (
        <p className="sub-text">{hint}</p>
      ) : null}
    </div>
  )
}

export function FormGrid({
  cols = 1,
  className,
  children,
}: {
  cols?: 1 | 2 | 3 | 4
  className?: string
  children: ReactNode
}) {
  const colClass = {
    1: 'grid-cols-1',
    2: 'grid-cols-2',
    3: 'grid-cols-3',
    4: 'grid-cols-4',
  }[cols]
  return <div className={cn('grid gap-3', colClass, className)}>{children}</div>
}
