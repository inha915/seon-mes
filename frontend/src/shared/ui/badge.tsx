import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/shared/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1 whitespace-nowrap rounded px-1.5 py-0.5 text-[11.5px] font-medium ring-1 ring-inset',
  {
    variants: {
      variant: {
        default: 'bg-primary/10 text-primary ring-primary/20',
        secondary: 'bg-muted text-muted-foreground ring-border',
        success: 'bg-success/10 text-success ring-success/25',
        warning: 'bg-warning/15 text-warning-foreground ring-warning/30',
        info: 'bg-info/10 text-info ring-info/25',
        destructive: 'bg-destructive/10 text-destructive ring-destructive/25',
        outline: 'bg-card text-foreground ring-border',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

function Badge({ className, variant, ...props }: React.ComponentProps<'span'> & VariantProps<typeof badgeVariants>) {
  return <span data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
