import type { ReactNode } from 'react';
import { cn } from '@/shared/lib/utils';

/** 제목줄이 있는 업무 패널 (폼, 그리드, 상세 정보를 담는 기본 틀) */
export function Panel({
  title,
  icon,
  actions,
  className,
  bodyClassName,
  children,
  ...rest
}: {
  title?: ReactNode;
  icon?: ReactNode;
  actions?: ReactNode;
  className?: string;
  /** 본문 여백. 그리드처럼 꽉 채울 때는 'p-0' */
  bodyClassName?: string;
  children: ReactNode;
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
  );
}
