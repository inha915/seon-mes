import * as React from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/shared/lib/utils';

/**
 * shadcn/ui native-select: 업무 폼에서 키보드 입력이 빠른 네이티브 select.
 * className 은 너비 지정용으로 바깥 래퍼에 적용됩니다 (기본 w-full).
 */
function NativeSelect({ className, children, ...props }: React.ComponentProps<'select'>) {
  return (
    <div className={cn('relative w-full', className)}>
      <select
        data-slot="native-select"
        className={cn(
          'h-8 w-full appearance-none rounded-md border border-input bg-card pl-2.5 pr-8 text-sm shadow-xs outline-none disabled:cursor-not-allowed disabled:opacity-50',
          'focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30',
          'aria-invalid:border-destructive',
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
    </div>
  );
}

export { NativeSelect };
