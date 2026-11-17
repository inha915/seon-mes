import type { ReactNode } from 'react'
import { cn } from '@/shared/lib/utils'

export function Panel({
  title,
  icon,
  actions,
  className,
  bodyClassName,
  children,
  ...rest
}: {
  title?: ReactNode
  icon?: ReactNode
  actions?: ReactNode
  className?: string
  bodyClassName?: string
  children: ReactNode
} & Omit<React.HTMLAttributes<HTMLDivElement>, 'title'>) {
  return (
    <div className={cn('panel', className)} {...rest}>
      {(title || actions) && (
        <div className="panel-header">
          <h2 className="panel-title">
            {icon}
            {title}
          </h2>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className={cn('panel-body', bodyClassName)}>{children}</div>
    </div>
  )
}
