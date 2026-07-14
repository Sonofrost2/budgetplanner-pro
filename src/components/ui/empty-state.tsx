import { ReactNode } from 'react';
import { LucideIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  secondaryAction?: ReactNode;
  /** Compact variant fits inside small cards / tabs. */
  variant?: 'default' | 'compact';
  className?: string;
  /** Set to false to render without the outer Card wrapper (for nesting inside a Card already). */
  bordered?: boolean;
}

/**
 * Coherent empty state used across the app.
 * Icon in a soft circle, title, helper text, and up to two actions.
 */
export const EmptyState = ({
  icon: Icon,
  title,
  description,
  action,
  secondaryAction,
  variant = 'default',
  className,
  bordered = true,
}: EmptyStateProps) => {
  const content = (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center',
        variant === 'compact' ? 'py-8 px-4' : 'py-14 px-6',
        className,
      )}
    >
      {Icon && (
        <div
          className={cn(
            'rounded-2xl bg-muted/60 border border-border/40 flex items-center justify-center mb-4',
            variant === 'compact' ? 'w-12 h-12' : 'w-16 h-16',
          )}
          aria-hidden
        >
          <Icon className={cn('text-muted-foreground', variant === 'compact' ? 'w-6 h-6' : 'w-8 h-8')} />
        </div>
      )}
      <h3 className={cn('font-semibold text-foreground', variant === 'compact' ? 'text-sm' : 'text-base')}>
        {title}
      </h3>
      {description && (
        <p
          className={cn(
            'text-muted-foreground mt-1.5 max-w-md',
            variant === 'compact' ? 'text-xs' : 'text-sm',
          )}
        >
          {description}
        </p>
      )}
      {(action || secondaryAction) && (
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          {action}
          {secondaryAction}
        </div>
      )}
    </div>
  );

  if (!bordered) return content;

  return (
    <Card className="border border-dashed border-border/60 bg-muted/20 shadow-none rounded-2xl">
      <CardContent className="p-0">{content}</CardContent>
    </Card>
  );
};

export default EmptyState;